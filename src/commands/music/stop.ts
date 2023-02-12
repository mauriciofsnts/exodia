import { client } from 'index'
import { Embed, Reply } from 'commands/reply'
import { Command } from 'core/command'
import { i18n } from 'utils/i18n'

export default new Command({
  name: 'stop',
  description: i18n.__('stop.description'),
  categorie: '🎧 Audio',
  aliases: ['stop'],
  run: async ({ interaction, type }) => {
    if (!interaction.member.voice.channel || !interaction.guild)
      return Reply(
        Embed({
          title: 'Error',
          description: i18n.__('common.errorNotChannel'),
          type: 'error',
        }),
        interaction,
        type
      )

    const queue = client.queues.get(interaction.guild.id)

    if (!queue)
      return Reply(
        Embed({
          title: '',
          description: i18n.__('stop.errorNotQueue'),
          type: 'success',
        }),
        interaction,
        type
      )

    queue.stop()

    return Reply(
      Embed({
        description: i18n.__mf('stop.result', {
          author: interaction.member.nickname,
        }),
        type: 'success',
      }),
      interaction,
      type
    )
  },
})
