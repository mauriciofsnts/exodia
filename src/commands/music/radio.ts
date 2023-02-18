import { client } from 'index'
import {
  DiscordGatewayAdapterCreator,
  joinVoiceChannel,
} from '@discordjs/voice'
import { ApplicationCommandOptionType, InteractionType } from 'discord.js'
import { Embed, Reply, ReplyMusicEmbed } from 'commands/reply'
import { Command } from 'core/command'
import { Song } from 'core/song'
import { MusicQueue } from 'core/player'
import { isOnServer, isOnVoiceChannel } from 'validations/channel'

enum Radios {
  rap = 'https://www.youtube.com/watch?v=05689ErDUdM',
  lofi = 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
}

export default new Command({
  name: 'radio',
  description: 'plays a pre-defined radio',
  categorie: '🎧 Audio',
  aliases: ['radio'],
  options: [
    {
      name: 'option',
      description: 'music style',
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        { name: 'rap', value: 'rap' },
        { name: 'lofi', value: 'lofi' },
      ],
    },
  ],
  validations: [isOnVoiceChannel, isOnServer],
  run: async ({ interaction, args, type, commandParams }) => {
    const { guild, member } = commandParams

    const radioName =
      interaction.type === InteractionType.ApplicationCommand
        ? String(interaction.options.get('option')?.value)
        : Array.isArray(args) && args.join(' ')

    if (!radioName)
      return Reply(
        Embed({
          description: 'You need to inform the song title',
          type: 'success',
        }),
        interaction,
        type
      )

    let song

    try {
      const option = radioName as keyof typeof Radios

      if (!(option in Radios)) {
        return Reply(
          Embed({
            description: `The option ${option} is not configured`,
            type: 'success',
          }),
          interaction,
          type
        )
      }

      song = await Song.from(Radios[option])
    } catch (error) {
      return Reply(
        Embed({
          description: 'An error occurred when reproducing the radio',
          type: 'error',
        }),
        interaction,
        type
      )
    }

    const queue = client.queues.get(guild.id)

    if (queue) {
      queue.songs.push(song)

      Reply(
        Embed({
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
        channelId: member.voice?.channelId ?? '',
        guildId: guild.id,
        adapterCreator:
          guild.voiceAdapterCreator as DiscordGatewayAdapterCreator,
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
