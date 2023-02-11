import { ApplicationCommandOptionType, InteractionType } from 'discord.js'
import { Embed, Reply } from 'commands/reply'
import { Command } from 'core/command'
import { client } from 'index'
import { i18n } from 'utils/i18n'
import { Playlist } from 'core/playlist'
import { MusicQueue } from 'core/player'
import {
  DiscordGatewayAdapterCreator,
  joinVoiceChannel,
} from '@discordjs/voice'
import { Song } from 'core/song'

export default new Command({
  name: 'playlist',
  description: i18n.__('playlist.description'),
  aliases: ['playlist', 'pl'],
  options: [
    {
      name: 'query',
      description: 'playlist url or search query',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  run: async ({ interaction, args, type }) => {
    const queue = client.queues.get(interaction.guild!.id)

    if (!interaction.member.voice.channel || !interaction.guild)
      return Reply(
        Embed({
          description: i18n.__('common.errorNotChannel'),
          type: 'error',
        }),
        interaction,
        type
      )

    const query =
      interaction.type === InteractionType.ApplicationCommand
        ? String(interaction.options.get('query')?.value)
        : Array.isArray(args) && args.join(' ')

    if (!query)
      return Reply(
        Embed({
          description: i18n.__('playlist.usagesReply'),
          type: 'success',
        }),
        interaction,
        type
      )

    let playlist

    try {
      playlist = await Playlist.from(query)
    } catch (error) {
      console.error(error)

      return Reply(
        Embed({
          description: i18n.__('playlist.errorNotFoundPlaylist'),
          type: 'success',
        }),
        interaction,
        type
      )
    }

    if (queue) {
      queue.songs.push(...playlist.videos)
    } else {
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

      newQueue.songs.push(...playlist.videos)

      newQueue.enqueue(playlist.videos[0])
    }

    let playlistDescription = playlist.videos
      .map((song: Song, index: number) => `${index + 1}. ${song.title}`)
      .join('\n')

    if (playlistDescription!.length >= 2048)
      playlistDescription =
        playlistDescription!.substr(0, 2007) +
        i18n.__('playlist.playlistCharLimit')

    const playlistEmbed = Embed({
      title: `${playlist.data.title}`,
      description: playlistDescription,
      type: 'success',
    })

    return Reply(playlistEmbed, interaction, type)
  },
})
