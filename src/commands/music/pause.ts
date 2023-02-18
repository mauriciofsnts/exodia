import { Embed, Reply } from 'commands/reply'
import { Command } from 'core/command'
import { client } from 'index'
import { i18n } from 'utils/i18n'

import { hasQueue } from 'validations/audio'
import { isOnVoiceChannel, isOnServer } from 'validations/channel'

export default new Command({
  name: 'pause',
  description: i18n.__('pause.description'),
  categorie: '🎧 Audio',
  aliases: ['ps', 'pause'],
  validations: [isOnVoiceChannel, isOnServer, hasQueue],
  run: async ({ interaction, type, commandParams }) => {
    const { queue, member } = commandParams

    const paused = queue.player.pause()

    if (paused) {
      return Reply(
        Embed({
          description: i18n.__mf('pause.result', {
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
