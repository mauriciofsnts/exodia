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

      Reply(
        Embed({
          description: i18n.__mf('play.queueAdded', {
            author: interaction.member.nickname,
            title: song.title,
            duration: convertDurationToTimeString(song.duration),
          }),
          type: 'success',
        }),
        interaction,
        type
      )

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

    Reply(
      Embed({
        description: i18n.__mf('play.queueAdded', {
          title: song.title,
          duration: convertDurationToTimeString(song.duration),
        }),
        type: 'success',
      }),
      interaction,
      type
    )
  },
})
