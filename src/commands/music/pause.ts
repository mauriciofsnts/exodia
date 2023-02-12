import { Embed, Reply } from 'commands/reply'
import { Command } from 'core/command'
import { client } from 'index'
import { i18n } from 'utils/i18n'

export default new Command({
  name: 'pause',
  description: i18n.__('pause.description'),
  categorie: '🎧 Audio',
  aliases: ['ps', 'pause'],
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
          description: i18n.__('pause.errorNotQueue'),
          type: 'error',
        }),
        interaction,
        type
      )

    const paused = queue.player.pause()

    if (paused) {
      return Reply(
        Embed({
          description: i18n.__mf('pause.result', {
            author: interaction.member.nickname,
          }),
          type: 'success',
        }),
        interaction,
        type
      )
    }

    return Reply(
      Embed({
        description: i18n.__('common.errorCommand'),
        type: 'error',
      }),
      interaction,
      type
    )
  },
})
