import {
  DiscordGatewayAdapterCreator,
  joinVoiceChannel,
} from '@discordjs/voice'
import { ApplicationCommandOptionType, InteractionType } from 'discord.js'
import { client } from '../..'
import { Command } from '../../core/command'
import { MusicQueue } from '../../core/Player'
import { Song } from '../../core/song'
import { Embed, Reply } from '../reply'

export default new Command({
  name: 'play',
  description: 'play a song',
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
    if (!interaction.member.voice.channel)
      return Reply(
        Embed({
          title: 'Error',
          description: 'You need it is on a voice channel',
          type: 'error',
        }),
        interaction,
        type
      )

    if (!interaction.guild)
      return Reply(
        Embed({
          title: 'Error',
          description: 'You need it is on a server to execute this command',
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
          title: 'Error',
          description: 'You need to inform the song title',
          type: 'error',
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
          title: `Ok`,
          description: `${song.title} added to playlist`,
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
        title: `Ok`,
        description: `${song.title} adicionado a playlist`,
        type: 'success',
      }),
      interaction,
      type
    )
  },
})
