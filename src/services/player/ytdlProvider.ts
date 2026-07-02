import type { Readable } from "node:stream";
import {
  AudioPlayerStatus,
  type AudioResource,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  NoSubscriberBehavior,
  StreamType,
  type VoiceConnection,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import ytdl from "@distube/ytdl-core";
import type { Client, VoiceBasedChannel } from "discord.js";
import { type Video, YouTube } from "youtube-sr";
import type { Config } from "@/config/index";
import { PlayerError } from "@/lib/errors";
import type { Logger } from "@/lib/logger";
import type { AudioProvider, AudioSession, TrackEndResult } from "./provider";
import type { Track } from "./track";
import type { SearchResult } from "./youtubeSearch";

const READY_TIMEOUT_MS = 20_000; // give a slow voice handshake room before failing
const RECONNECT_TIMEOUT_MS = 5_000; // window to recover a dropped connection

type PlayerClient = NonNullable<ytdl.downloadOptions["playerClients"]>[number];

// Streams YouTube audio directly with @distube/ytdl-core over @discordjs/voice.
// From a datacenter IP this hits YouTube's bot-check unless YTDL_COOKIE (a
// logged-in session) is supplied — see src/config for the trade-offs. Kept
// behind AUDIO_PROVIDER=ytdl; Lavalink stays the reliable default.
export class YtdlProvider implements AudioProvider {
  private agent: ytdl.Agent | undefined;
  private playerClients: PlayerClient[] | undefined;

  constructor(
    config: Config,
    private logger: Logger,
  ) {
    this.agent = this.buildAgent(config.YTDL_COOKIE);
    this.playerClients = this.parsePlayerClients(config.YTDL_PLAYER_CLIENTS);
  }

  connect(_client: Client): void {
    // No-op: @discordjs/voice reads voice state from each guild's adapter at join
    // time, so there's nothing to build up front.
    this.logger.info(
      { cookie: Boolean(this.agent), playerClients: this.playerClients },
      "ytdl audio provider ready",
    );
  }

  // Turns YTDL_COOKIE into a ytdl agent. Accepts either a JSON array of cookie
  // objects ([{ "name": "...", "value": "..." }]) or a raw Cookie header string
  // ("k=v; k2=v2"). Without it, ytdl runs anonymously and is bot-checked in a DC.
  private buildAgent(cookie: string | undefined): ytdl.Agent | undefined {
    if (!cookie) return undefined;
    try {
      const trimmed = cookie.trim();
      const cookies = trimmed.startsWith("[")
        ? (JSON.parse(trimmed) as { name: string; value: string }[])
        : trimmed
            .split(";")
            .map((pair) => pair.trim())
            .filter(Boolean)
            .map((pair) => {
              const eq = pair.indexOf("=");
              return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim() };
            });
      return ytdl.createAgent(cookies);
    } catch (err) {
      this.logger.error({ err }, "Failed to parse YTDL_COOKIE — running ytdl without cookies");
      return undefined;
    }
  }

  private parsePlayerClients(raw: string | undefined): PlayerClient[] | undefined {
    if (!raw) return undefined;
    const clients = raw
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean) as PlayerClient[];
    return clients.length > 0 ? clients : undefined;
  }

  private isUrl(query: string): boolean {
    return /^https?:\/\//i.test(query.trim());
  }

  private toResult(video: Video): SearchResult | null {
    if (!video.id || !video.url) return null;
    return {
      title: video.title ?? "Unknown",
      url: video.url,
      duration: Math.round((video.duration ?? 0) / 1000), // youtube-sr gives ms
    };
  }

  async search(query: string): Promise<SearchResult | null> {
    try {
      if (this.isUrl(query)) {
        if (!YouTube.validate(query.trim(), "VIDEO")) return null;
        const video = await YouTube.getVideo(query.trim());
        return this.toResult(video);
      }
      const video = await YouTube.searchOne(query, "video");
      return video ? this.toResult(video) : null;
    } catch (err) {
      this.logger.warn({ err, query }, "ytdl search failed");
      return null;
    }
  }

  async searchMany(query: string, limit: number): Promise<SearchResult[]> {
    try {
      if (this.isUrl(query)) {
        const single = await this.search(query);
        return single ? [single] : [];
      }
      const videos = await YouTube.search(query, { limit, type: "video" });
      return videos
        .map((v) => this.toResult(v))
        .filter((r): r is SearchResult => r !== null)
        .slice(0, limit);
    } catch (err) {
      this.logger.warn({ err, query }, "ytdl searchMany failed");
      return [];
    }
  }

  async joinVoice(channel: VoiceBasedChannel): Promise<AudioSession> {
    const connection = joinVoiceChannel({
      guildId: channel.guild.id,
      channelId: channel.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, READY_TIMEOUT_MS);
    } catch (err) {
      connection.destroy();
      this.logger.error({ err, guildId: channel.guild.id }, "ytdl voice connection timed out");
      throw new PlayerError("Não consegui conectar ao canal de voz. Tente novamente.");
    }

    return new YtdlSession(connection, this.logger, (track) => this.openStream(track));
  }

  // Builds the raw audio stream for a track, applying cookies/playerClients.
  private openStream(track: Track) {
    return ytdl(track.url, {
      filter: "audioonly",
      quality: "highestaudio",
      highWaterMark: 1 << 25, // 32 MiB — smooths over slow chunks so audio doesn't stutter
      agent: this.agent,
      playerClients: this.playerClients,
    });
  }
}

// Per-guild @discordjs/voice session. Guards onEnd with the live resource so it
// fires exactly once per play() (a stray Idle when nothing is playing is ignored).
class YtdlSession implements AudioSession {
  private player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
  });
  private current: AudioResource | null = null;
  private endCb: ((result: TrackEndResult) => void) | null = null;
  private closedCb: (() => void) | null = null;
  private destroyed = false;

  constructor(
    private connection: VoiceConnection,
    private logger: Logger,
    private openStream: (track: Track) => Readable,
  ) {
    this.connection.subscribe(this.player);
    this.attachEvents();
  }

  get paused(): boolean {
    return (
      this.player.state.status === AudioPlayerStatus.Paused ||
      this.player.state.status === AudioPlayerStatus.AutoPaused
    );
  }

  async play(track: Track): Promise<void> {
    const stream = this.openStream(track);
    // A stream-level failure (bot-check, dead video) won't surface as a player
    // error, so translate it into a track failure so the queue advances.
    stream.on("error", (err) => {
      this.logger.error({ err, url: track.url }, "ytdl stream error");
      this.finish("failed");
    });

    const resource = createAudioResource(stream, {
      inputType: StreamType.Arbitrary,
      inlineVolume: true, // lets setVolume adjust gain live (needs the PCM path)
    });
    this.current = resource;
    this.player.play(resource);
  }

  pause(): void {
    this.player.pause();
  }

  resume(): void {
    this.player.unpause();
  }

  setVolume(percent: number): void {
    this.current?.volume?.setVolume(percent / 100);
  }

  stopTrack(): void {
    // stop() → Idle → onEnd("finished"); force so a paused player still stops.
    this.player.stop(true);
  }

  async destroy(): Promise<void> {
    this.destroyed = true;
    this.current = null;
    this.player.stop(true);
    if (this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
      this.connection.destroy();
    }
  }

  onEnd(cb: (result: TrackEndResult) => void): void {
    this.endCb = cb;
  }

  onClosed(cb: () => void): void {
    this.closedCb = cb;
  }

  // Fires onEnd once for the live track, then clears the guard so a follow-up
  // event (e.g. a stream error after Idle) is dropped.
  private finish(result: TrackEndResult): void {
    if (!this.current) return;
    this.current = null;
    this.endCb?.(result);
  }

  private attachEvents(): void {
    // Idle after a track means it finished (or was stopped) — advance the queue.
    this.player.on(AudioPlayerStatus.Idle, () => this.finish("finished"));

    this.player.on("error", (err) => {
      this.logger.error({ err }, "ytdl audio player error");
      this.finish("failed");
    });

    // A dropped connection: try a brief recovery, otherwise treat it as closed.
    this.connection.on(VoiceConnectionStatus.Disconnected, () => {
      void this.handleDisconnect();
    });

    this.connection.on(VoiceConnectionStatus.Destroyed, () => {
      if (!this.destroyed) this.closedCb?.();
    });
  }

  private async handleDisconnect(): Promise<void> {
    try {
      await Promise.race([
        entersState(this.connection, VoiceConnectionStatus.Signalling, RECONNECT_TIMEOUT_MS),
        entersState(this.connection, VoiceConnectionStatus.Connecting, RECONNECT_TIMEOUT_MS),
      ]);
      // Recovering on its own — let it reconnect.
    } catch {
      if (!this.destroyed) this.closedCb?.();
    }
  }
}
