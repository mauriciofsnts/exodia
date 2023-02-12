import { client } from 'index'
import { Embed, Reply } from 'commands/reply'
import { Command } from 'core/command'
import { i18n } from 'utils/i18n'

export default new Command({
  name: 'resume',
  description: i18n.__('resume.description'),
  categorie: '🎧 Audio',
  aliases: ['resume', 'r'],
  run: async ({ interaction, type }) => {
    if (!interaction.member.voice.channel || !interaction.guild)
      return Reply(
        Embed({
          description: i18n.__('common.errorNotChannel'),
          type: 'success',
        }),
        interaction,
        type
      )

    const queue = client.queues.get(interaction.guild.id)

    if (!queue)
      return Reply(
        Embed({
          description: i18n.__('resume.errorNotQueue'),
          type: 'success',
        }),
        interaction,
        type
      )

    const unpause = queue.player.unpause()

    if (unpause) {
      return Reply(
        Embed({
          description: i18n.__mf('resume.resultNotPlaying', {
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
