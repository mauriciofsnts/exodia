import {
  DiscordGatewayAdapterCreator,
  joinVoiceChannel,
} from '@discordjs/voice'
import {
  ApplicationCommandOptionChoiceData,
  ApplicationCommandOptionType,
  InteractionType,
} from 'discord.js'
import { client } from '../..'
import { Command } from '../../core/command'
import { MusicQueue } from '../../core/Player'
import { Song } from '../../core/song'
import { Embed, Reply, ReplyMusicEmbed } from '../reply'

enum Radios {
  rap = 'https://www.youtube.com/watch?v=Qm4r1fyz61Y',
}

export default new Command({
  name: 'radio',
  description: 'plays a pre-defined radio',
  aliases: ['radio'],
  options: [
    {
      name: 'option',
      description: 'music style',
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        { name: 'rap', value: 'rap' },
      ] as ApplicationCommandOptionChoiceData[],
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

    const radioName =
      interaction.type === InteractionType.ApplicationCommand
        ? String(interaction.options.get('option')?.value)
        : Array.isArray(args) && (args.join(' ') as string)

    if (!radioName)
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

    console.log('radioName: ', radioName)

    try {
      const type = radioName as keyof typeof Radios
      if (!type) throw new Error(`The option ${type} is not configured`)

      console.log('Type: ', Radios[type])

      song = await Song.from(Radios[type])
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
      ReplyMusicEmbed({
        duration: song.duration,
        member: interaction.user?.username ?? '-',
        title: song.title,
        thumbnail: song.thumbnail,
        query: radioName,
      }),
      interaction,
      type
    )
  },
})
