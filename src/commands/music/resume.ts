import { Embed, Reply } from 'commands/reply'
import { Command } from 'core/command'
import { i18n } from 'utils/i18n'
import { isOnServer, isOnVoiceChannel } from 'validations/channel'
import { hasQueue } from 'validations/audio'

export default new Command({
  name: 'resume',
  description: i18n.__('resume.description'),
  categorie: '🎧 Audio',
  validations: [isOnVoiceChannel, isOnServer, hasQueue],
  aliases: ['resume', 'r'],
  run: async ({ interaction, type, commandParams }) => {
    const { queue, member } = commandParams

    const unpause = queue.resume()

    if (unpause) {
      return Reply(
        Embed({
          description: i18n.__mf('resume.resultNotPlaying', {
            author: member.nickname,
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
