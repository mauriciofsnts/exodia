import { client } from '../..'
import { Command } from '../../core/command'
import { Embed, Reply } from '../reply'

export default new Command({
  name: 'skip',
  description: 'Skip the music',
  aliases: ['s', 'skip'],
  run: async ({ interaction, type }) => {
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

    const queue = client.queues.get(interaction.guild.id)

    if (!queue)
      return Reply(
        Embed({
          title: 'Error',
          description: 'There is nothing playing that I could skip for you',
          type: 'error',
        }),
        interaction,
        type
      )

    queue.player.stop(true)

    return Reply(
      Embed({
        title: 'Ok',
        description: 'Skiping',
        type: 'success',
      }),
      interaction,
      type
    )
  },
})
