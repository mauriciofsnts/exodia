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
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  Message,
  User,
} from 'discord.js'
import { Color } from 'commands/reply'
import { convertDurationToTimeString } from 'utils/date-convert'
import { i18n } from 'utils/i18n'

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

    const embed = new EmbedBuilder()
      .setColor(Color.success)
      .setTitle(i18n.__('nowplaying.embedTitle'))
      .addFields(
        { name: 'Title', value: song.title },
        { name: 'Duration', value: convertDurationToTimeString(song.duration) }
      )
      .setFooter({ text: 'Reproduzindo de youtube' })

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('pause')
        .setEmoji('⏸️')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('next')
        .setEmoji('⏭️')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('stop')
        .setEmoji('⏹️')
        .setStyle(ButtonStyle.Secondary)
    )

    const msg = await this.interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true,
    })

    const filter = (i: any) => i.user.id !== this.interaction.client.user!.id

    const collector = msg.createMessageComponentCollector({
      filter,
      time: song.duration > 0 ? song.duration * 1000 : 600000,
    })

    collector.on('collect', async (collection) => {
      await collection.deferUpdate()

      switch (collection.customId) {
        case 'pause':
          if (this.player.state.status === AudioPlayerStatus.Paused) {
            this.player.unpause()

            const updatedRow =
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setCustomId('pause')
                  .setEmoji('⏸️')
                  .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                  .setCustomId('next')
                  .setEmoji('⏭️')
                  .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                  .setCustomId('stop')
                  .setEmoji('⏹️')
                  .setStyle(ButtonStyle.Secondary)
              )

            await collection.editReply({
              embeds: [embed],
              components: [updatedRow],
            })
          } else {
            this.player.pause()

            const updatedRow =
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setCustomId('pause')
                  .setEmoji('▶️')
                  .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                  .setCustomId('next')
                  .setEmoji('⏭️')
                  .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                  .setCustomId('stop')
                  .setEmoji('⏹️')
                  .setStyle(ButtonStyle.Secondary)
              )

            await collection.editReply({
              embeds: [embed],
              components: [updatedRow],
            })
          }
          break

        case 'next':
          this.player.stop(true)
          break

        case 'stop':
          this.stop()
          break
      }
    })

    collector.on('end', async () => {
      await msg.delete()
    })
  }
}
