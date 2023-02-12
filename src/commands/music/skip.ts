import { client } from 'index'
import { Embed, Reply } from 'commands/reply'
import { Command } from 'core/command'
import { i18n } from 'utils/i18n'

export default new Command({
  name: 'skip',
  description: i18n.__('skip.description'),
  categorie: '🎧 Audio',
  aliases: ['s', 'skip'],
  run: async ({ interaction, type }) => {
    if (!interaction.member.voice.channel || !interaction.guild)
      return Reply(
        Embed({
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
          description: i18n.__('skip.errorNotQueue'),
          type: 'success',
        }),
        interaction,
        type
      )

    queue.player.stop(true)

    return Reply(
      Embed({
        description: i18n.__mf('skip.result', {
          author: interaction.member.nickname,
        }),
        type: 'success',
      }),
      interaction,
      type
    )
  },
})
