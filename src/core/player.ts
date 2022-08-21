import { ExtendedInteraction } from './../types/command'
import {
  AudioPlayer,
  AudioPlayerState,
  AudioPlayerStatus,
  AudioResource,
  createAudioPlayer,
  NoSubscriberBehavior,
  VoiceConnection,
  VoiceConnectionStatus,
} from '@discordjs/voice'
import { Song } from './song'
import { client } from '..'

interface QueueOptions {
  connection: VoiceConnection
  interaction: ExtendedInteraction
}

export class MusicQueue {
  public readonly interaction!: ExtendedInteraction
  public readonly player!: AudioPlayer
  public readonly connection!: VoiceConnection
  public readonly client = client

  public resource!: AudioResource
  public songs: Song[] = []
  public volume = 100

  public constructor(options: QueueOptions) {
    Object.assign(this, options)

    this.interaction = options.interaction
    this.player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Play },
    })
    this.connection.subscribe(this.player)

    this.player.on(
      'stateChange',
      async (oldState: AudioPlayerState, newState: AudioPlayerState) => {
        if (
          oldState.status !== AudioPlayerStatus.Idle &&
          newState.status === AudioPlayerStatus.Idle
        ) {
          this.songs.shift()

          this.processQueue()
        } else if (
          oldState.status === AudioPlayerStatus.Buffering &&
          newState.status === AudioPlayerStatus.Playing
        ) {
          // this.sendPlayingMessage(newState);
          console.log('now playing... ')
        }
      }
    )

    this.player.on('error', (e) => {
      console.error('Error on playing: ', e.message, ' ', e.cause, ' ', e.name)
    })
  }

  public enqueue(...songs: Song[]) {
    this.songs = this.songs.concat(songs)
    this.processQueue()
  }

  public stop() {
    this.songs = []
    this.player.stop()

    client.queues.delete(this.interaction.guild!.id)

    // !config.PRUNING && this.textChannel.send(i18n.__("play.queueEnded")).catch(console.error);

    setTimeout(() => {
      if (
        this.player.state.status !== AudioPlayerStatus.Idle ||
        this.connection.state.status === VoiceConnectionStatus.Destroyed ||
        client.queues.get(this.interaction.guild!.id) !== undefined
      )
        return

      this.connection.destroy()
      this.player.stop()
      client.queues.delete(this.interaction.guild!.id)

      // !config.PRUNING && this.textChannel.send(i18n.__("play.leaveChannel"));
    }, 100)
  }

  private async processQueue(): Promise<void> {
    if (this.player.state.status !== AudioPlayerStatus.Idle) {
      return
    }

    if (!this.songs.length) {
      return this.stop()
    }

    const nextSong = this.songs[0]

    try {
      const resource = await nextSong.makeResource()

      console.log('resource: ', resource)

      this.resource = resource!
      this.player.play(this.resource)
      this.resource.volume?.setVolumeLogarithmic(this.volume / 100)
    } catch (error) {
      console.error('process queue error: ', error)

      return this.processQueue()
    }
  }
}
