import { ApplicationCommandType } from 'discord.js'
import { Embed, Reply } from 'commands/reply'
import { Command } from 'core/command'
import { i18n } from 'utils/i18n'
import { uuid } from 'utils/uuid'

export default new Command({
  name: 'uuid',
  description: i18n.__('uuid.description'),
  type: ApplicationCommandType.ChatInput,
  aliases: ['uuid'],
  run: async ({ interaction, type }) => {
    const embed = Embed({
      title: 'UUID',
      description: uuid(),
      type: 'info',
    })

    Reply(embed, interaction, type)
  },
})
