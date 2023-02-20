import { Reply, Embed } from 'commands/reply'
import { i18n } from 'utils/i18n'
import { ExtendedInteraction, InteractionType } from 'types/command'

const isOnVoiceChannel = (
  interaction: ExtendedInteraction,
  type: InteractionType
) => {
  if (!interaction.member?.voice.channel) {
    Reply(
      Embed({
        description: i18n.__('common.errorNotChannel'),
        type: 'error',
      }),
      interaction,
      type
    )

    return false
  }

  return true
}

const isOnServer = (
  interaction: ExtendedInteraction,
  type: InteractionType
) => {
  if (!interaction.guild) {
    Reply(
      Embed({
        description: i18n.__('common.errorNotGuild'),
        type: 'error',
      }),
      interaction,
      type
    )

    return false
  }

  return true
}

export { isOnVoiceChannel, isOnServer }
