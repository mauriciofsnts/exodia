import {
  AudioPlayer,
  AudioPlayerState,
  AudioPlayerStatus,
  AudioResource,
  createAudioPlayer,
  entersState,
  NoSubscriberBehavior,
  VoiceConnection,
  VoiceConnectionDisconnectReason,
  VoiceConnectionState,
  VoiceConnectionStatus,
} from '@discordjs/voice'
import { Song } from './song'
import { client } from 'index'
import { promisify } from 'util'
import { ExtendedInteraction } from 'types/command'
import { QueueOptions } from 'types/queue'
import { Message, User } from 'discord.js'

const wait = promisify(setTimeout)
export class MusicQueue {
  public readonly interaction!: ExtendedInteraction
  public readonly player!: AudioPlayer
  public readonly connection!: VoiceConnection
  public readonly client = client

  public resource!: AudioResource
  public songs: Song[] = []
  public volume = 100

  public readyLock = false

  public constructor(options: QueueOptions) {
    Object.assign(this, options)

    this.interaction = options.interaction
    this.player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Play },
    })
    this.connection.subscribe(this.player)

    this.connection.on(
      'stateChange' as any,
      async (
        oldState: VoiceConnectionState,
        newState: VoiceConnectionState
      ) => {
        if (newState.status === VoiceConnectionStatus.Disconnected) {
          if (
            newState.reason ===
              VoiceConnectionDisconnectReason.WebSocketClose &&
            newState.closeCode === 4014
          ) {
            try {
              this.stop()
            } catch (e) {
              console.log(e)
              this.stop()
            }
          } else if (this.connection.rejoinAttempts < 5) {
            await wait((this.connection.rejoinAttempts + 1) * 5_000)
            this.connection.rejoin()
          } else {
            this.connection.destroy()
          }
        } else if (newState.status === VoiceConnectionStatus.Destroyed) {
          // this.stop();
        } else if (
          !this.readyLock &&
          (newState.status === VoiceConnectionStatus.Connecting ||
            newState.status === VoiceConnectionStatus.Signalling)
        ) {
          this.readyLock = true
          try {
            await entersState(
              this.connection,
              VoiceConnectionStatus.Ready,
              20_000
            )
          } catch {
            if (
              this.connection.state.status !== VoiceConnectionStatus.Destroyed
            )
              this.connection.destroy()
          } finally {
            this.readyLock = false
          }
        }
      }
    )

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
          // TODO: now playing msg
          // console.log('now playing...', oldState, newState)
          this.sendNowPlaying(newState)
        }
      }
    )

    this.player.on('error', (e) => {
      console.error('Error on playing: ', e.message, ' ', e.name)
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

    // TODO: queue end msg return

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

      // TODO: leaving channel msg
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

      this.resource = resource!
      this.player.play(this.resource)
      this.resource.volume?.setVolumeLogarithmic(this.volume / 100)
    } catch (error) {
      console.error('process queue error: ', error)

      return this.processQueue()
    }
  }

  public async sendNowPlaying(newState: any): Promise<void> {
    const song = (newState.resource as AudioResource<Song>).metadata

    let msg: Message | undefined

    try {
      msg = await this.interaction.reply({
        content: `Now playing: ${song.title}`,
        fetchReply: true,
      })

      await msg.react('⏭️')
      await msg.react('⏹️')
      await msg.react('⏸️')
    } catch (error) {
      console.error('now playing error: ', error)
      return
    }

    const filter = (reaction: any, user: User) =>
      user.id !== this.interaction.client.user!.id

    // if (!msg) return
    console.log('msg : ', msg)

    const collector = msg?.createReactionCollector({
      filter,
      time: song.duration > 0 ? song.duration * 1000 : 600000,
    })

    collector?.on('collect', async (reaction: any, user: User) => {
      if (!this.songs) return

      switch (reaction.emoji.name) {
        case '⏭️':
          reaction.users.remove(user.id).catch((e: any) => console.error(e))
          this.player.stop(true)
          break
        case '⏹️':
          reaction.users.remove(user.id).catch((e: any) => console.error(e))
          this.stop()
          break
        case '⏸️':
          reaction.users.remove(user.id).catch((e: any) => console.error(e))
          if (this.player.state.status === AudioPlayerStatus.Paused) {
            this.player.unpause()
          } else {
            this.player.pause()
          }
          break
        case '🔉':
          reaction.users.remove(user.id).catch((e: any) => console.error(e))
          if (this.volume <= 0.1) return
          this.resource.volume?.setVolumeLogarithmic(
            (this.resource.volume.volume - 0.1) * this.volume
          )
          break
        case '🔊':
          reaction.users.remove(user.id).catch((e: any) => console.error(e))
          if (this.volume >= 1) return
          this.resource.volume?.setVolumeLogarithmic(
            (this.resource.volume.volume + 0.1) * this.volume
          )
          break
      }
    })
  }
}
