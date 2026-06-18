import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  type AudioPlayer,
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
import type { VoiceBasedChannel } from "discord.js";
import youtubeDl from "youtube-dl-exec";
import { PlayerError } from "@/lib/errors.js";
import type { Logger } from "@/lib/logger.js";
import { ytdlpLimiter } from "@/lib/ytdlp.js";
import { Queue } from "./queue.js";
import type { Track } from "./track.js";

// Short jingle played once per session (right after joining) to cover the delay
// while yt-dlp resolves and buffers the first track. Optional — skipped if absent.
const INTRO_PATH = fileURLToPath(new URL("../../../assets/intro.mp3", import.meta.url));
const HAS_INTRO = existsSync(INTRO_PATH);

// Lets the command layer react to playback events (announce in a text channel,
// report a broken track, etc.) without coupling the player to discord.js text APIs.
export interface PlayerNotifier {
  trackStart(track: Track): void;
  trackError(track: Track): void;
}

// Detached playback errors (audio player faults, yt-dlp streaming failures) fire
// outside any command, so they bypass the command middleware. A reporter lets the
// host wire them to the admin notifier without coupling the player to discord.js.
export interface PlayerErrorReport {
  guildId: string;
  stage: "player" | "stream";
  url?: string;
}
export type PlayerErrorReporter = (err: unknown, report: PlayerErrorReport) => void;

interface PreparedTrack {
  track: Track;
  resource: AudioResource;
}

interface GuildPlayer {
  connection: VoiceConnection;
  player: AudioPlayer;
  queue: Queue;
  current: Track | null;
  notifier: PlayerNotifier | null;
  idleTimer: NodeJS.Timeout | null;
  introPending: boolean; // play the intro before the first track of this session
  pending: PreparedTrack | null; // a buffered track to play on next Idle (e.g. after the intro)
}

const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60_000;
const READY_TIMEOUT_MS = 20_000; // how long to wait for the voice connection to come up

const DEFAULT_VOLUME = 1; // 1.0 = 100%
const MAX_VOLUME = 2; // 200% — guard against blown-out audio

export class PlayerManager {
  private guilds = new Map<string, GuildPlayer>();
  // Per-guild playback volume (a gain multiplier), kept off GuildPlayer so it
  // survives a voice reconnect that rebuilds the GuildPlayer. Applied to each new
  // track resource and, live, to the one currently playing.
  private volumes = new Map<string, number>();
  // Optional sink for detached playback errors (see PlayerErrorReporter).
  private errorReporter: PlayerErrorReporter | null = null;

  setErrorReporter(reporter: PlayerErrorReporter): void {
    this.errorReporter = reporter;
  }

  constructor(
    private logger: Logger,
    private idleTimeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS,
  ) {}

  async play(channel: VoiceBasedChannel, track: Track, notifier?: PlayerNotifier): Promise<void> {
    const guildPlayer = await this.ensureReady(channel);
    if (notifier) guildPlayer.notifier = notifier;
    guildPlayer.queue.enqueue(track);
    this.clearIdleTimer(guildPlayer);

    if (guildPlayer.player.state.status === AudioPlayerStatus.Idle) {
      await this.processQueue(channel.guild.id);
    }
  }

  // Connects to the voice channel without queuing anything, playing the intro (if
  // present) to signal a successful connection. Used by the search flow so the
  // bot is already in the channel — intro covering the wait — while the user
  // picks a track. A later play() won't replay the intro (consumed here); if
  // nothing gets queued, the idle disconnect leaves the channel on its own.
  async join(channel: VoiceBasedChannel): Promise<void> {
    const guildPlayer = await this.ensureReady(channel);
    if (guildPlayer.player.state.status !== AudioPlayerStatus.Idle) return;

    if (guildPlayer.introPending && HAS_INTRO) {
      guildPlayer.introPending = false;
      this.clearIdleTimer(guildPlayer);
      // When the intro ends the Idle handler runs processQueue, which arms the
      // idle disconnect if still nothing is queued.
      guildPlayer.player.play(createAudioResource(INTRO_PATH, { inputType: StreamType.Arbitrary }));
    } else if (guildPlayer.queue.isEmpty) {
      this.scheduleIdleDisconnect(channel.guild.id);
    }
  }

  skip(guildId: string): void {
    const guildPlayer = this.requireGuild(guildId);
    guildPlayer.pending = null; // drop a track waiting behind the intro, if any
    guildPlayer.player.stop();
  }

  stop(guildId: string): void {
    const guildPlayer = this.requireGuild(guildId);
    guildPlayer.pending = null;
    guildPlayer.queue.clear();
    guildPlayer.player.stop();
  }

  pause(guildId: string): void {
    this.requireGuild(guildId).player.pause();
  }

  resume(guildId: string): void {
    this.requireGuild(guildId).player.unpause();
  }

  // Toggles pause/resume. Returns true when the player is now paused.
  togglePause(guildId: string): boolean {
    const guildPlayer = this.requireGuild(guildId);
    if (guildPlayer.player.state.status === AudioPlayerStatus.Paused) {
      guildPlayer.player.unpause();
      return false;
    }
    guildPlayer.player.pause();
    return true;
  }

  shuffle(guildId: string): void {
    this.requireGuild(guildId).queue.shuffle();
  }

  // Current volume as a percentage (100 = original). Reflects the saved gain even
  // before anything plays.
  getVolume(guildId: string): number {
    return Math.round((this.volumes.get(guildId) ?? DEFAULT_VOLUME) * 100);
  }

  // Sets volume (in percent, clamped to 0–200), applying it live to the playing
  // track and to every track queued afterwards. Returns the applied percentage.
  setVolume(guildId: string, percent: number): number {
    const guildPlayer = this.requireGuild(guildId);
    const clamped = Math.min(Math.max(Math.round(percent), 0), MAX_VOLUME * 100);
    const gain = clamped / 100;
    this.volumes.set(guildId, gain);

    const state = guildPlayer.player.state;
    if ("resource" in state) state.resource.volume?.setVolume(gain);
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
    guildPlayer.player.stop();
    try {
      guildPlayer.connection.destroy();
    } catch {
      // connection may already be destroyed (e.g. after a failed reconnect)
    }
    this.guilds.delete(guildId);
    this.volumes.delete(guildId); // reset gain to default for the next session
  }

  destroyAll(): void {
    for (const guildId of this.guilds.keys()) {
      this.destroy(guildId);
    }
  }

  private createGuildPlayer(channel: VoiceBasedChannel): GuildPlayer {
    const guildId = channel.guild.id;
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true, // bot doesn't need to receive audio
      selfMute: false, // must be false to transmit
    });

    // Surfaces where a handshake hangs (run with LOG_LEVEL=debug to diagnose).
    connection.on("stateChange", (oldState, newState) => {
      this.logger.debug({ guildId, from: oldState.status, to: newState.status }, "Voice state");
    });
    connection.on("error", (err) => {
      this.logger.error({ err, guildId }, "Voice connection error");
    });

    // Keep playing while the connection (re)negotiates instead of auto-pausing.
    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    connection.subscribe(player);

    // Without an error listener a resource failure crashes the process — log and
    // let the Idle handler advance the queue.
    player.on("error", (error) => {
      this.logger.error({ err: error, guildId }, "Audio player error");
      this.errorReporter?.(error, { guildId, stage: "player" });
    });

    const guildPlayer: GuildPlayer = {
      connection,
      player,
      queue: new Queue(),
      current: null,
      notifier: null,
      idleTimer: null,
      introPending: HAS_INTRO,
      pending: null,
    };

    player.on(AudioPlayerStatus.Idle, () => {
      this.processQueue(guildId).catch((err) => {
        this.logger.error({ err, guildId }, "processQueue failed");
      });
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      // Could be a move to another channel (recoverable) or a real disconnect.
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroy(guildId);
      }
    });

    return guildPlayer;
  }

  // Returns a GuildPlayer whose voice connection is Ready. Reuses a healthy
  // connection; otherwise (re)builds and, if it hangs, recovers via rejoin().
  private async ensureReady(channel: VoiceBasedChannel): Promise<GuildPlayer> {
    const guildId = channel.guild.id;

    // Fail fast and clearly when we can't join at all (missing Connect/Speak or
    // the channel is full), instead of waiting out the connection timeout.
    if (!channel.joinable) {
      throw new PlayerError("Não consigo entrar nesse canal — falta permissão ou ele está cheio.");
    }

    const existing = this.guilds.get(guildId);
    if (existing?.connection.state.status === VoiceConnectionStatus.Ready) {
      return existing;
    }
    // Drop any stale / half-connected player before rebuilding.
    if (existing) this.destroy(guildId);

    const guildPlayer = this.createGuildPlayer(channel);
    this.guilds.set(guildId, guildPlayer);

    try {
      await entersState(guildPlayer.connection, VoiceConnectionStatus.Ready, READY_TIMEOUT_MS);
      return guildPlayer;
    } catch {
      // rejoin() re-sends the voice state to Discord — the canonical way to
      // unstick a connection hanging in signalling/connecting.
      this.logger.warn(
        { guildId, state: guildPlayer.connection.state.status },
        "Voice not ready — rejoining",
      );
      try {
        guildPlayer.connection.rejoin();
        await entersState(guildPlayer.connection, VoiceConnectionStatus.Ready, READY_TIMEOUT_MS);
        return guildPlayer;
      } catch {
        this.destroy(guildId);
        throw new PlayerError("Não consegui conectar ao canal de voz. Tente novamente.");
      }
    }
  }

  private async processQueue(guildId: string): Promise<void> {
    const guildPlayer = this.guilds.get(guildId);
    if (!guildPlayer) return;

    // A resource prepared earlier (the track buffered behind the intro) takes
    // priority over dequeuing a new one.
    const prepared = guildPlayer.pending;
    if (prepared) {
      guildPlayer.pending = null;
      guildPlayer.current = prepared.track;
      guildPlayer.player.play(prepared.resource);
      guildPlayer.notifier?.trackStart(prepared.track);
      return;
    }

    const track = guildPlayer.queue.dequeue();

    if (!track) {
      guildPlayer.current = null;
      this.scheduleIdleDisconnect(guildId);
      return;
    }

    guildPlayer.current = track;

    try {
      // Spawning yt-dlp here starts the download immediately, so it buffers while
      // the intro (if any) plays — minimizing the gap before the track is audible.
      const resource = await this.createTrackResource(track, guildId);

      if (guildPlayer.introPending && HAS_INTRO) {
        guildPlayer.introPending = false;
        // Hold the track; the Idle handler plays it when the intro ends. stop()/
        // skip() clear `pending`, so they correctly cancel this handoff.
        guildPlayer.pending = { track, resource };
        guildPlayer.player.play(
          createAudioResource(INTRO_PATH, { inputType: StreamType.Arbitrary }),
        );
      } else {
        guildPlayer.player.play(resource);
        guildPlayer.notifier?.trackStart(track);
      }
    } catch (err) {
      // A single broken track (removed video, geo-block, extractor hiccup) must
      // not stall the whole queue — report it and move on to the next one.
      this.logger.error({ err, guildId, url: track.url }, "Failed to stream track — skipping");
      this.errorReporter?.(err, { guildId, stage: "stream", url: track.url });
      guildPlayer.notifier?.trackError(track);
      await this.processQueue(guildId);
    }
  }

  // Builds an audio resource from yt-dlp's stdout. The connection is ensured
  // Ready in play() before this runs. Pure-JS extractors (play-dl/ytdl-core) can
  // no longer decipher YouTube's player; yt-dlp does, and preferring Opus/WebM
  // itags keeps the input compact. `inlineVolume` adds a PCM volume stage
  // (decode → gain → re-encode via opusscript) so per-guild volume works — at the
  // cost of the otherwise transcode-free passthrough.
  private async createTrackResource(track: Track, guildId: string): Promise<AudioResource> {
    // Bound concurrent yt-dlp cold-starts (see ytdlp.ts). The slot is freed once
    // the stream is flowing or torn down — not held for the whole track — so the
    // limiter throttles startup bursts without capping simultaneous playback.
    const release = await ytdlpLimiter.acquire();
    try {
      // exec() spawns yt-dlp; stdout streams natively (no in-memory buffering).
      const subprocess = youtubeDl.exec(track.url, {
        output: "-",
        format: "251/250/249/bestaudio[ext=webm]/bestaudio",
        quiet: true,
        noWarnings: true,
      });
      // yt-dlp rejects when its stdout closes early (skip/stop) — swallow it.
      subprocess.catch(() => {});

      const audioStream = subprocess.stdout;
      if (!audioStream) throw new PlayerError("yt-dlp produced no audio stream");
      audioStream.on("error", () => {}); // avoid crashing on broken-pipe teardown

      // `readable` = first bytes decoded (cold start done); `close` is the safety
      // net if the stream errors out before producing anything. release() is
      // idempotent, so whichever fires first wins.
      audioStream.once("readable", release);
      audioStream.once("close", release);

      const resource = createAudioResource(audioStream, {
        inputType: StreamType.WebmOpus,
        inlineVolume: true,
      });
      resource.volume?.setVolume(this.volumes.get(guildId) ?? DEFAULT_VOLUME);
      return resource;
    } catch (err) {
      release();
      throw err;
    }
  }

  private scheduleIdleDisconnect(guildId: string): void {
    const guildPlayer = this.guilds.get(guildId);
    if (!guildPlayer) return;
    this.clearIdleTimer(guildPlayer);

    guildPlayer.idleTimer = setTimeout(() => {
      const gp = this.guilds.get(guildId);
      // Only leave if still idle — a new track may have started in the meantime.
      if (gp && gp.player.state.status === AudioPlayerStatus.Idle && gp.queue.isEmpty) {
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
