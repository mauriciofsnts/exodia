import { client } from 'index'
import { i18n } from 'utils/i18n'
import { Embed, Reply } from 'commands/reply'
import { ExtendedInteraction, InteractionType } from 'types/command'

const hasQueue = (interaction: ExtendedInteraction, type: InteractionType) => {
  const queue = client.distube.getQueue(interaction!.guild!.id)

  if (!queue || !queue.songs.length) {
    Reply(
      Embed({
        description: i18n.__('nowplaying.errorNotQueue'),
        type: 'error',
      }),
      interaction,
      type
    )

    return false
  }

  return true
}

export { hasQueue }
