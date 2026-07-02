import type { Client, VoiceBasedChannel } from "discord.js";
import type { Config } from "@/config/index";
import { PlayerError } from "@/lib/errors";
import type { Logger } from "@/lib/logger";
import type { AudioProvider, AudioSession, PlayerErrorReporter } from "./provider";
import { Queue } from "./queue";
import type { Track } from "./track";
import type { SearchResult } from "./youtubeSearch";

// Re-exported for the host layer (bot.ts wires the reporter to the admin notifier).
export type { PlayerErrorReport, PlayerErrorReporter } from "./provider";

// Lets the command layer react to playback events (announce in a text channel,
// report a broken track, etc.) without coupling the player to discord.js text APIs.
export interface PlayerNotifier {
  trackStart(track: Track): void;
  trackError(track: Track): void;
}

interface GuildPlayer {
  session: AudioSession; // per-guild playback handle from the active provider
  queue: Queue;
  current: Track | null;
  notifier: PlayerNotifier | null;
  idleTimer: NodeJS.Timeout | null;
}

const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60_000;

const DEFAULT_VOLUME = 100; // percent — 100 == original loudness
const MAX_VOLUME = 200; // 200% — guard against blown-out audio

// Provider-agnostic playback orchestrator: owns the per-guild queue, idle
// disconnect, volume state, notifier, and error reporting. All backend-specific
// mechanics (search, voice join, streaming) are delegated to an AudioProvider.
export class PlayerManager {
  private guilds = new Map<string, GuildPlayer>();
  // Per-guild playback volume (percent), kept off GuildPlayer so it survives a
  // voice reconnect that rebuilds the GuildPlayer. Applied to each new track and,
  // live, to the one currently playing.
  private volumes = new Map<string, number>();
  private errorReporter: PlayerErrorReporter | null = null;
  private idleTimeoutMs: number;

  constructor(
    private logger: Logger,
    config: Config,
    private provider: AudioProvider,
  ) {
    this.idleTimeoutMs = config.PLAYER_IDLE_TIMEOUT_MS ?? DEFAULT_IDLE_TIMEOUT_MS;
  }

  setErrorReporter(reporter: PlayerErrorReporter): void {
    this.errorReporter = reporter;
    // Let the provider surface its own detached faults (e.g. a Lavalink node error).
    this.provider.setErrorReporter?.(reporter);
  }

  // Prepares the audio backend. Must run before login so voice state/server
  // updates from the gateway reach the provider.
  connect(client: Client): void {
    this.provider.connect(client);
  }

  // Resolves a single track for the command layer (URL or best search match).
  search(query: string): Promise<SearchResult | null> {
    return this.provider.search(query);
  }

  // Returns up to `limit` candidates for a free-text query, for a selection menu.
  searchMany(query: string, limit: number): Promise<SearchResult[]> {
    return this.provider.searchMany(query, limit);
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
    this.requireGuild(guildId).session.stopTrack();
  }

  stop(guildId: string): void {
    const guildPlayer = this.requireGuild(guildId);
    guildPlayer.queue.clear();
    guildPlayer.session.stopTrack();
  }

  pause(guildId: string): void {
    this.requireGuild(guildId).session.pause();
  }

  resume(guildId: string): void {
    this.requireGuild(guildId).session.resume();
  }

  // Toggles pause/resume. Returns true when the player is now paused.
  togglePause(guildId: string): boolean {
    const guildPlayer = this.requireGuild(guildId);
    const next = !guildPlayer.session.paused;
    if (next) guildPlayer.session.pause();
    else guildPlayer.session.resume();
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
    guildPlayer.session.setVolume(clamped);
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
    // Delete first so the session's "closed" callback (fired by leaving) is a no-op.
    this.guilds.delete(guildId);
    this.volumes.delete(guildId); // reset gain to default for the next session
    guildPlayer.session.destroy().catch((err) => {
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

    let session: AudioSession;
    try {
      session = await this.provider.joinVoice(channel);
    } catch (err) {
      if (err instanceof PlayerError) throw err;
      this.logger.error({ err, guildId }, "Failed to join voice channel");
      throw new PlayerError("Não consegui conectar ao canal de voz. Tente novamente.");
    }

    const guildPlayer: GuildPlayer = {
      session,
      queue: new Queue(),
      current: null,
      notifier: null,
      idleTimer: null,
    };
    this.guilds.set(guildId, guildPlayer);

    session.onEnd((result) => {
      this.onTrackOver(guildId, result === "failed").catch((err) =>
        this.logger.error({ err, guildId }, "onTrackOver failed"),
      );
    });
    session.onClosed(() => this.destroy(guildId));

    return guildPlayer;
  }

  // Advances the queue when the current track finishes or fails. Idempotent: the
  // session guarantees onEnd fires once per track, and the `current` guard drops a
  // callback that arrives after we've already moved past the track.
  private async onTrackOver(guildId: string, errored: boolean): Promise<void> {
    const guildPlayer = this.guilds.get(guildId);
    if (!guildPlayer?.current) return;

    const ended = guildPlayer.current;
    guildPlayer.current = null;

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
      this.scheduleIdleDisconnect(guildId);
      return;
    }

    try {
      guildPlayer.current = track;
      await guildPlayer.session.play(track);
      guildPlayer.session.setVolume(this.volumes.get(guildId) ?? DEFAULT_VOLUME);
      guildPlayer.notifier?.trackStart(track);
    } catch (err) {
      // A single broken track (removed video, geo-block, resolve hiccup) must not
      // stall the whole queue — report it and move on to the next one.
      this.logger.error({ err, guildId, url: track.url }, "Failed to play track — skipping");
      this.errorReporter?.(err, { guildId, stage: "stream", url: track.url });
      guildPlayer.notifier?.trackError(track);
      guildPlayer.current = null;
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
