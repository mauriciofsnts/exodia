import { ApplicationCommandType } from 'discord.js'
import { Command } from '../../core/command'
import { uuid } from '../../helpers/uuid'
import { Embed, Reply } from '../reply'

export default new Command({
  name: 'uuid',
  description: 'returns random uuid',
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
