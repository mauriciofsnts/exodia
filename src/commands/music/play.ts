import {
  DiscordGatewayAdapterCreator,
  joinVoiceChannel,
} from '@discordjs/voice'
import { Reply, Embed } from 'commands/reply'
import { Command } from 'core/command'
import { MusicQueue } from 'core/player'
import { Song } from 'core/song'
import { ApplicationCommandOptionType, InteractionType } from 'discord.js'
import { client } from 'index'
import { convertDurationToTimeString } from 'utils/date-convert'
import { i18n } from 'utils/i18n'

export default new Command({
  name: 'play',
  description: i18n.__('play.description'),
  categorie: '🎧 Audio',
  aliases: ['p', 'play'],
  options: [
    {
      name: 'songtitle',
      description: 'title of the song',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  run: async ({ interaction, args, type }) => {
    if (!interaction.member.voice.channel || !interaction.guild)
      return Reply(
        Embed({
          description: i18n.__('play.errorNotChannel'),
          type: 'error',
        }),
        interaction,
        type
      )

    const songTitle =
      interaction.type === InteractionType.ApplicationCommand
        ? String(interaction.options.get('songtitle')?.value)
        : Array.isArray(args) && args.join(' ')

    if (!songTitle)
      return Reply(
        Embed({
          description: i18n.__('play.errorNotChannel'),
          type: 'success',
        }),
        interaction,
        type
      )

    let song

    try {
      song = await Song.from(songTitle)
    } catch (error) {
      console.error('Error on execute', error)
      return
    }

    const queue = client.queues.get(interaction.guild.id)

    if (queue) {
      queue.songs.push(song)

      // sum of queue duration
      const totalDuration = queue.songs.reduce(
        (acc, song) => acc + song.duration,
        0
      )

      const tracksInQueue = queue.songs.length

      const embed = Embed({
        title: i18n.__('play.queueAdded'),
        thumbnail: song.thumbnail,
        type: 'success',
      })

      embed.addFields({
        name: i18n.__('play.songTitle'),
        value: song.title,
      })

      embed.addFields({
        name: i18n.__('play.queueTracksInQueue'),
        value: String(tracksInQueue),
        inline: true,
      })

      embed.addFields({
        name: i18n.__('play.queueTotalDuration'),
        value: convertDurationToTimeString(totalDuration),
        inline: true,
      })

      Reply(embed, interaction, type)
      return
    }

    const newQueue = new MusicQueue({
      interaction,
      connection: joinVoiceChannel({
        channelId: interaction.member.voice.channel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild
          .voiceAdapterCreator as DiscordGatewayAdapterCreator,
      }),
    })

    client.queues.set(interaction.guild!.id, newQueue)

    newQueue.enqueue(song)

    const totalDuration = newQueue.songs.reduce(
      (acc, song) => acc + song.duration,
      0
    )

    const tracksInQueue = newQueue.songs.length

    const embed = Embed({
      title: i18n.__('play.queueAdded'),
      thumbnail: song.thumbnail,
      type: 'success',
    })

    embed.addFields({
      name: i18n.__('play.songTitle'),
      value: song.title,
    })

    embed.addFields({
      name: i18n.__('play.queueTracksInQueue'),
      value: String(tracksInQueue),
      inline: true,
    })

    embed.addFields({
      name: i18n.__('play.queueTotalDuration'),
      value: convertDurationToTimeString(totalDuration),
      inline: true,
    })

    Reply(embed, interaction, type)
  },
})
