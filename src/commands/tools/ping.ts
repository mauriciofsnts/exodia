import { ApplicationCommandType, EmbedBuilder } from 'discord.js'
import { Command } from '../../core/command'
import { Embed, Reply } from '../reply'

export default new Command({
  name: 'ping',
  description: 'returns websocket ping',
  type: ApplicationCommandType.ChatInput,
  run: async ({ client, interaction, type }) => {
    const embed = Embed({
      title: 'Connection',
      description: `${client.ws.ping}ms!`,
      type: 'info',
    })

    Reply(embed, interaction, type)
  },
})
