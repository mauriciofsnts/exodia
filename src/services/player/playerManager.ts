import {
  type AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  type VoiceConnection,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import type { VoiceBasedChannel } from "discord.js";
import { stream } from "play-dl";
import { PlayerError } from "@/lib/errors.js";
import type { Logger } from "@/lib/logger.js";
import { Queue } from "./queue.js";
import type { Track } from "./track.js";

// Lets the command layer react to playback events (announce in a text channel,
// report a broken track, etc.) without coupling the player to discord.js text APIs.
export interface PlayerNotifier {
  trackStart(track: Track): void;
  trackError(track: Track): void;
}

interface GuildPlayer {
  connection: VoiceConnection;
  player: AudioPlayer;
  queue: Queue;
  current: Track | null;
  notifier: PlayerNotifier | null;
  idleTimer: NodeJS.Timeout | null;
}

const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60_000;

export class PlayerManager {
  private guilds = new Map<string, GuildPlayer>();

  constructor(
    private logger: Logger,
    private idleTimeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS,
  ) {}

  async play(channel: VoiceBasedChannel, track: Track, notifier?: PlayerNotifier): Promise<void> {
    const guildPlayer = this.getOrCreate(channel);
    if (notifier) guildPlayer.notifier = notifier;
    guildPlayer.queue.enqueue(track);
    this.clearIdleTimer(guildPlayer);

    if (guildPlayer.player.state.status === AudioPlayerStatus.Idle) {
      await this.processQueue(channel.guild.id);
    }
  }

  skip(guildId: string): void {
    const guildPlayer = this.guilds.get(guildId);
    if (!guildPlayer) throw new PlayerError("Não há nada tocando.");
    guildPlayer.player.stop();
  }

  stop(guildId: string): void {
    const guildPlayer = this.guilds.get(guildId);
    if (!guildPlayer) throw new PlayerError("Não há nada tocando.");
    guildPlayer.queue.clear();
    guildPlayer.player.stop();
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
  }

  destroyAll(): void {
    for (const guildId of this.guilds.keys()) {
      this.destroy(guildId);
    }
  }

  private getOrCreate(channel: VoiceBasedChannel): GuildPlayer {
    const existing = this.guilds.get(channel.guild.id);
    if (existing) return existing;

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    const guildPlayer: GuildPlayer = {
      connection,
      player,
      queue: new Queue(),
      current: null,
      notifier: null,
      idleTimer: null,
    };

    player.on(AudioPlayerStatus.Idle, () => {
      this.processQueue(channel.guild.id).catch((err) => {
        this.logger.error({ err, guildId: channel.guild.id }, "processQueue failed");
      });
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroy(channel.guild.id);
      }
    });

    this.guilds.set(channel.guild.id, guildPlayer);
    return guildPlayer;
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

    guildPlayer.current = track;

    try {
      const { stream: audioStream, type } = await stream(track.url, { quality: 2 });
      const resource = createAudioResource(audioStream, { inputType: type });
      guildPlayer.player.play(resource);
      guildPlayer.notifier?.trackStart(track);
    } catch (err) {
      // A single broken track (removed video, geo-block, play-dl hiccup) must not
      // stall the whole queue — report it and move on to the next one.
      this.logger.error({ err, guildId, url: track.url }, "Failed to stream track — skipping");
      guildPlayer.notifier?.trackError(track);
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
