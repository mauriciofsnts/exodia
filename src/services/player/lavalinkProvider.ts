import type { Client, VoiceBasedChannel } from "discord.js";
import { Connectors, type Track as LavalinkTrack, LoadType, type Player, Shoukaku } from "shoukaku";
import type { Config } from "@/config/index";
import { PlayerError } from "@/lib/errors";
import type { Logger } from "@/lib/logger";
import type { AudioProvider, AudioSession, PlayerErrorReporter, TrackEndResult } from "./provider";
import type { Track } from "./track";
import { type SearchResult, toSearchResult } from "./youtubeSearch";

// Streams via a Lavalink server (Shoukaku + youtube-source plugin). Audio
// resolution and playback are remote, which sidesteps the datacenter-IP
// "Sign in to confirm you're not a bot" block that direct extraction hits.
export class LavalinkProvider implements AudioProvider {
  private shoukaku: Shoukaku | null = null;
  private errorReporter: PlayerErrorReporter | null = null;

  constructor(
    private config: Config,
    private logger: Logger,
  ) {}

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

  async search(query: string): Promise<SearchResult | null> {
    const track = await this.resolveTrack(query);
    return track ? toSearchResult(track) : null;
  }

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

  async joinVoice(channel: VoiceBasedChannel): Promise<AudioSession> {
    const player = await this.requireShoukaku().joinVoiceChannel({
      guildId: channel.guild.id,
      channelId: channel.id,
      shardId: channel.guild.shardId,
      deaf: true,
    });
    return new LavalinkSession(
      player,
      (query) => this.resolveTrack(query),
      () => this.requireShoukaku().leaveVoiceChannel(channel.guild.id),
    );
  }
}

// Wraps a Shoukaku Player as an AudioSession. The `currentEncoded` guard dedupes
// the backend's end/stuck events against the live track so onEnd fires exactly
// once per play() (Lavalink emits a follow-up end after an exception).
class LavalinkSession implements AudioSession {
  private currentEncoded: string | null = null;
  private endCb: ((result: TrackEndResult) => void) | null = null;
  private closedCb: (() => void) | null = null;

  constructor(
    private player: Player,
    private resolveTrack: (query: string) => Promise<LavalinkTrack | null>,
    private leave: () => Promise<void>,
  ) {
    this.attachEvents();
  }

  get paused(): boolean {
    return this.player.paused;
  }

  async play(track: Track): Promise<void> {
    const resolved = await this.resolveTrack(track.url);
    if (!resolved) throw new PlayerError("Não consegui resolver essa faixa.");
    this.currentEncoded = resolved.encoded;
    await this.player.playTrack({ track: { encoded: resolved.encoded } });
  }

  pause(): void {
    void this.player.setPaused(true);
  }

  resume(): void {
    void this.player.setPaused(false);
  }

  setVolume(percent: number): void {
    void this.player.setGlobalVolume(percent);
  }

  stopTrack(): void {
    void this.player.stopTrack();
  }

  async destroy(): Promise<void> {
    this.currentEncoded = null;
    await this.leave();
  }

  onEnd(cb: (result: TrackEndResult) => void): void {
    this.endCb = cb;
  }

  onClosed(cb: () => void): void {
    this.closedCb = cb;
  }

  // Fires onEnd once for the live track, then clears the guard so stale follow-up
  // events (a post-exception "end") are dropped.
  private finish(result: TrackEndResult, encoded: string): void {
    if (this.currentEncoded && this.currentEncoded !== encoded) return;
    this.currentEncoded = null;
    this.endCb?.(result);
  }

  private attachEvents(): void {
    // 'replaced' fires when we deliberately swap tracks (we don't) and 'cleanup'
    // when the player is torn down — neither should advance the queue.
    this.player.on("end", (data) => {
      if (data.reason === "replaced" || data.reason === "cleanup") return;
      this.finish(data.reason === "loadFailed" ? "failed" : "finished", data.track.encoded);
    });

    this.player.on("stuck", (data) => {
      this.finish("failed", data.track.encoded);
    });

    // Lavalink emits a TrackEndEvent (reason "loadFailed") right after an
    // exception, so the queue advances there — this is only diagnostic.
    this.player.on("exception", () => {});

    this.player.on("closed", () => {
      this.closedCb?.();
    });
  }
}
