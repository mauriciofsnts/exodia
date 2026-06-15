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
import { Queue } from "./queue.js";
import type { Track } from "./track.js";

interface GuildPlayer {
  connection: VoiceConnection;
  player: AudioPlayer;
  queue: Queue;
  current: Track | null;
}

export class PlayerManager {
  private guilds = new Map<string, GuildPlayer>();

  async play(channel: VoiceBasedChannel, track: Track): Promise<void> {
    const guildPlayer = this.getOrCreate(channel);
    guildPlayer.queue.enqueue(track);

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
    guildPlayer.player.stop();
    guildPlayer.connection.destroy();
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
    };

    player.on(AudioPlayerStatus.Idle, () => {
      this.processQueue(channel.guild.id).catch(() => {});
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
      return;
    }

    guildPlayer.current = track;

    const { stream: audioStream } = await stream(track.url, { quality: 2 });
    const resource = createAudioResource(audioStream);
    guildPlayer.player.play(resource);
  }
}
