import type { Client, VoiceBasedChannel } from "discord.js";
import { Connectors, type Track as LavalinkTrack, LoadType, type Player, Shoukaku } from "shoukaku";
import type { Config } from "@/config/index";
import { PlayerError } from "@/lib/errors";
import type { Logger } from "@/lib/logger";
import { Queue } from "./queue";
import type { Track } from "./track";
import { type SearchResult, toSearchResult } from "./youtubeSearch";

// Lets the command layer react to playback events (announce in a text channel,
// report a broken track, etc.) without coupling the player to discord.js text APIs.
export interface PlayerNotifier {
  trackStart(track: Track): void;
  trackError(track: Track): void;
}

// Detached playback errors (Lavalink node faults, track exceptions) fire outside
// any command, so they bypass the command middleware. A reporter lets the host
// wire them to the admin notifier without coupling the player to discord.js.
export interface PlayerErrorReport {
  guildId: string;
  stage: "player" | "stream";
  url?: string;
}
export type PlayerErrorReporter = (err: unknown, report: PlayerErrorReport) => void;

interface GuildPlayer {
  player: Player; // Shoukaku player (voice connection + remote audio player)
  queue: Queue;
  current: Track | null;
  currentEncoded: string | null; // dedupes end/stuck events against the live track
  notifier: PlayerNotifier | null;
  idleTimer: NodeJS.Timeout | null;
}

const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60_000;

const DEFAULT_VOLUME = 100; // percent — Lavalink's 100 == original loudness
const MAX_VOLUME = 200; // 200% — guard against blown-out audio

export class PlayerManager {
  private guilds = new Map<string, GuildPlayer>();
  // Per-guild playback volume (percent), kept off GuildPlayer so it survives a
  // voice reconnect that rebuilds the GuildPlayer. Applied to each new track and,
  // live, to the one currently playing.
  private volumes = new Map<string, number>();
  // Optional sink for detached playback errors (see PlayerErrorReporter).
  private errorReporter: PlayerErrorReporter | null = null;
  private shoukaku: Shoukaku | null = null;
  private idleTimeoutMs: number;

  constructor(
    private logger: Logger,
    private config: Config,
  ) {
    this.idleTimeoutMs = config.PLAYER_IDLE_TIMEOUT_MS ?? DEFAULT_IDLE_TIMEOUT_MS;
  }

  setErrorReporter(reporter: PlayerErrorReporter): void {
    this.errorReporter = reporter;
  }

  // Builds the Shoukaku client and binds it to the discord.js gateway. Must run
  // before login so the DiscordJS connector catches voice state/server updates.
  connect(client: Client): void {
    const node = {
      name: "main",
      url: `${this.config.LAVALINK_HOST}:${this.config.LAVALINK_PORT}`,
      auth: this.config.LAVALINK_PASSWORD,
      secure: this.config.LAVALINK_SECURE,
    };
    this.shoukaku = new Shoukaku(new Connectors.DiscordJS(client), [node], {
      moveOnDisconnect: false,
      resume: false,
    });
    this.shoukaku.on("ready", (name) => this.logger.info({ node: name }, "Lavalink node ready"));
    this.shoukaku.on("error", (name, err) => {
      this.logger.error({ err, node: name }, "Lavalink node error");
      this.errorReporter?.(err, { guildId: "-", stage: "player" });
    });
    this.shoukaku.on("close", (name, code, reason) =>
      this.logger.warn({ node: name, code, reason }, "Lavalink node closed"),
    );
  }

  private requireShoukaku(): Shoukaku {
    if (!this.shoukaku) throw new PlayerError("O player de música ainda não está pronto.");
    return this.shoukaku;
  }

  private node() {
    const node = this.requireShoukaku().getIdealNode();
    if (!node) throw new PlayerError("Nenhum servidor de música disponível no momento.");
    return node;
  }

  private isUrl(query: string): boolean {
    return /^https?:\/\//i.test(query.trim());
  }

  // Resolves one playable Lavalink track from a free-text query or direct URL.
  private async resolveTrack(query: string): Promise<LavalinkTrack | null> {
    const identifier = this.isUrl(query) ? query.trim() : `ytsearch:${query}`;
    const res = await this.node().rest.resolve(identifier);
    if (!res) {
      this.logger.warn({ identifier }, "Lavalink resolve returned no response");
      return null;
    }
    switch (res.loadType) {
      case LoadType.TRACK:
        return res.data;
      case LoadType.SEARCH:
        return res.data[0] ?? null;
      case LoadType.PLAYLIST:
        return res.data.tracks[0] ?? null;
      case LoadType.ERROR:
        // The most useful signal when nothing plays: the plugin's own message
        // (e.g. a YouTube source that failed to load, or a bot-check rejection).
        this.logger.error({ identifier, exception: res.data }, "Lavalink resolve error");
        return null;
      default:
        // EMPTY — usually means no source matched the identifier (e.g. the
        // youtube-source plugin didn't load, so YouTube URLs match nothing).
        this.logger.warn({ identifier, loadType: res.loadType }, "Lavalink resolve empty");
        return null;
    }
  }

  // Resolves a single track for the command layer (URL or best search match).
  async search(query: string): Promise<SearchResult | null> {
    const track = await this.resolveTrack(query);
    return track ? toSearchResult(track) : null;
  }

  // Returns up to `limit` candidates for a free-text query, for a selection menu.
  async searchMany(query: string, limit: number): Promise<SearchResult[]> {
    const identifier = this.isUrl(query) ? query.trim() : `ytsearch:${query}`;
    const res = await this.node().rest.resolve(identifier);
    if (!res) return [];

    const tracks =
      res.loadType === LoadType.SEARCH
        ? res.data
        : res.loadType === LoadType.TRACK
          ? [res.data]
          : res.loadType === LoadType.PLAYLIST
            ? res.data.tracks
            : [];

    return tracks
      .map(toSearchResult)
      .filter((r): r is SearchResult => r !== null)
      .slice(0, limit);
  }

  async play(channel: VoiceBasedChannel, track: Track, notifier?: PlayerNotifier): Promise<void> {
    const guildPlayer = await this.ensureReady(channel);
    if (notifier) guildPlayer.notifier = notifier;
    guildPlayer.queue.enqueue(track);
    this.clearIdleTimer(guildPlayer);

    if (!guildPlayer.current) {
      await this.processQueue(channel.guild.id);
    }
  }

  // Connects to the voice channel without queuing anything. Used by the search
  // flow so the bot is already in the channel while the user picks a track; if
  // nothing gets queued, the idle disconnect leaves the channel on its own.
  async join(channel: VoiceBasedChannel): Promise<void> {
    const guildPlayer = await this.ensureReady(channel);
    if (!guildPlayer.current && guildPlayer.queue.isEmpty) {
      this.scheduleIdleDisconnect(channel.guild.id);
    }
  }

  skip(guildId: string): void {
    void this.requireGuild(guildId).player.stopTrack();
  }

  stop(guildId: string): void {
    const guildPlayer = this.requireGuild(guildId);
    guildPlayer.queue.clear();
    void guildPlayer.player.stopTrack();
  }

  pause(guildId: string): void {
    void this.requireGuild(guildId).player.setPaused(true);
  }

  resume(guildId: string): void {
    void this.requireGuild(guildId).player.setPaused(false);
  }

  // Toggles pause/resume. Returns true when the player is now paused.
  togglePause(guildId: string): boolean {
    const guildPlayer = this.requireGuild(guildId);
    const next = !guildPlayer.player.paused;
    void guildPlayer.player.setPaused(next);
    return next;
  }

  shuffle(guildId: string): void {
    this.requireGuild(guildId).queue.shuffle();
  }

  // Current volume as a percentage (100 = original). Reflects the saved value even
  // before anything plays.
  getVolume(guildId: string): number {
    return Math.round(this.volumes.get(guildId) ?? DEFAULT_VOLUME);
  }

  // Sets volume (in percent, clamped to 0–200), applying it live to the playing
  // track and to every track queued afterwards. Returns the applied percentage.
  setVolume(guildId: string, percent: number): number {
    const guildPlayer = this.requireGuild(guildId);
    const clamped = Math.min(Math.max(Math.round(percent), 0), MAX_VOLUME);
    this.volumes.set(guildId, clamped);
    void guildPlayer.player.setGlobalVolume(clamped);
    return clamped;
  }

  private requireGuild(guildId: string): GuildPlayer {
    const guildPlayer = this.guilds.get(guildId);
    if (!guildPlayer) throw new PlayerError("Não há nada tocando.");
    return guildPlayer;
  }

  getQueue(guildId: string): Queue | null {
    return this.guilds.get(guildId)?.queue ?? null;
  }

  getCurrent(guildId: string): Track | null {
    return this.guilds.get(guildId)?.current ?? null;
  }

  destroy(guildId: string): void {
    const guildPlayer = this.guilds.get(guildId);
    if (!guildPlayer) return;
    this.clearIdleTimer(guildPlayer);
    // Delete first so the player's "closed" event (fired by leaving) is a no-op.
    this.guilds.delete(guildId);
    this.volumes.delete(guildId); // reset gain to default for the next session
    this.shoukaku?.leaveVoiceChannel(guildId).catch((err) => {
      this.logger.warn({ err, guildId }, "Failed to leave voice channel");
    });
  }

  destroyAll(): void {
    for (const guildId of [...this.guilds.keys()]) {
      this.destroy(guildId);
    }
  }

  // Returns a connected GuildPlayer, joining the voice channel on first use.
  private async ensureReady(channel: VoiceBasedChannel): Promise<GuildPlayer> {
    const guildId = channel.guild.id;

    // Fail fast and clearly when we can't join at all (missing Connect/Speak or
    // the channel is full), instead of waiting out the connection timeout.
    if (!channel.joinable) {
      throw new PlayerError("Não consigo entrar nesse canal — falta permissão ou ele está cheio.");
    }

    const existing = this.guilds.get(guildId);
    if (existing) return existing;

    let player: Player;
    try {
      player = await this.requireShoukaku().joinVoiceChannel({
        guildId,
        channelId: channel.id,
        shardId: channel.guild.shardId,
        deaf: true,
      });
    } catch (err) {
      this.logger.error({ err, guildId }, "Failed to join voice channel");
      throw new PlayerError("Não consegui conectar ao canal de voz. Tente novamente.");
    }

    const guildPlayer: GuildPlayer = {
      player,
      queue: new Queue(),
      current: null,
      currentEncoded: null,
      notifier: null,
      idleTimer: null,
    };
    this.guilds.set(guildId, guildPlayer);
    this.attachEvents(guildId, player);
    return guildPlayer;
  }

  private attachEvents(guildId: string, player: Player): void {
    // 'replaced' fires when we deliberately swap tracks (we don't) and 'cleanup'
    // when the player is torn down — neither should advance the queue.
    player.on("end", (data) => {
      if (data.reason === "replaced" || data.reason === "cleanup") return;
      const errored = data.reason === "loadFailed";
      this.onTrackOver(guildId, errored, data.track.encoded).catch((err) =>
        this.logger.error({ err, guildId }, "onTrackOver (end) failed"),
      );
    });

    player.on("stuck", (data) => {
      this.logger.warn({ guildId, threshold: data.thresholdMs }, "Track stuck");
      this.onTrackOver(guildId, true, data.track.encoded).catch((err) =>
        this.logger.error({ err, guildId }, "onTrackOver (stuck) failed"),
      );
    });

    // Lavalink emits a TrackEndEvent (reason "loadFailed") right after an
    // exception, so the queue advances there — here we only log.
    player.on("exception", (data) => {
      this.logger.error({ guildId, exception: data.exception }, "Lavalink track exception");
    });

    player.on("closed", (data) => {
      this.logger.warn(
        { guildId, code: data.code, reason: data.reason },
        "Voice connection closed",
      );
      this.destroy(guildId);
    });
  }

  // Advances the queue when the current track finishes or fails. Idempotent: the
  // `encoded` guard drops stale end/stuck events for a track we've already moved
  // past (e.g. an exception's follow-up end after we already advanced).
  private async onTrackOver(guildId: string, errored: boolean, encoded: string): Promise<void> {
    const guildPlayer = this.guilds.get(guildId);
    if (!guildPlayer?.current) return;
    if (guildPlayer.currentEncoded && guildPlayer.currentEncoded !== encoded) return;

    const ended = guildPlayer.current;
    guildPlayer.current = null;
    guildPlayer.currentEncoded = null;

    if (errored) {
      this.logger.error({ guildId, url: ended.url }, "Track failed — skipping");
      this.errorReporter?.(new PlayerError("Track playback failed"), {
        guildId,
        stage: "stream",
        url: ended.url,
      });
      guildPlayer.notifier?.trackError(ended);
    }

    await this.processQueue(guildId);
  }

  private async processQueue(guildId: string): Promise<void> {
    const guildPlayer = this.guilds.get(guildId);
    if (!guildPlayer) return;

    const track = guildPlayer.queue.dequeue();
    if (!track) {
      guildPlayer.current = null;
      guildPlayer.currentEncoded = null;
      this.scheduleIdleDisconnect(guildId);
      return;
    }

    try {
      const resolved = await this.resolveTrack(track.url);
      if (!resolved) throw new PlayerError("Não consegui resolver essa faixa.");

      guildPlayer.current = track;
      guildPlayer.currentEncoded = resolved.encoded;
      await guildPlayer.player.playTrack({ track: { encoded: resolved.encoded } });
      await guildPlayer.player.setGlobalVolume(this.volumes.get(guildId) ?? DEFAULT_VOLUME);
      guildPlayer.notifier?.trackStart(track);
    } catch (err) {
      // A single broken track (removed video, geo-block, resolve hiccup) must not
      // stall the whole queue — report it and move on to the next one.
      this.logger.error({ err, guildId, url: track.url }, "Failed to play track — skipping");
      this.errorReporter?.(err, { guildId, stage: "stream", url: track.url });
      guildPlayer.notifier?.trackError(track);
      guildPlayer.current = null;
      guildPlayer.currentEncoded = null;
      await this.processQueue(guildId);
    }
  }

  private scheduleIdleDisconnect(guildId: string): void {
    const guildPlayer = this.guilds.get(guildId);
    if (!guildPlayer) return;
    this.clearIdleTimer(guildPlayer);

    guildPlayer.idleTimer = setTimeout(() => {
      const gp = this.guilds.get(guildId);
      // Only leave if still idle — a new track may have started in the meantime.
      if (gp && !gp.current && gp.queue.isEmpty) {
        this.logger.info({ guildId }, "Idle timeout reached — leaving voice channel");
        this.destroy(guildId);
      }
    }, this.idleTimeoutMs);
  }

  private clearIdleTimer(guildPlayer: GuildPlayer): void {
    if (guildPlayer.idleTimer) {
      clearTimeout(guildPlayer.idleTimer);
      guildPlayer.idleTimer = null;
    }
  }
}
