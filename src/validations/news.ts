import { Embed, Reply } from 'commands/reply'
import { client } from 'index'
import { ExtendedInteraction, InteractionType } from 'types/command'
import { ENVS, loadEnv } from 'utils/envHelper'

export const isMaxNewsRequestsReached = (
  interaction: ExtendedInteraction,
  type: InteractionType
) => {
  const dailyNewsRequest = client.dailyNewsRequest

  if (dailyNewsRequest === Number(loadEnv(ENVS.DAILY_MAX_REQUESTS))) {
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