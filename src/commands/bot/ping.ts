import { ApplicationCommandType } from 'discord.js'
import { Command } from '../../core/command'
import { i18n } from '../../utils/i18n'
import { Embed, Reply } from '../reply'

export default new Command({
  name: 'ping',
  description: i18n.__('ping.description'),
  type: ApplicationCommandType.ChatInput,
  aliases: ['ping'],
  run: async ({ client, interaction, type }) => {
    
    const embed = Embed({
      title: 'Ping',
      description: i18n.__mf('ping.result', {
        ping: Math.round(client.ws.ping),
      }),
      type: 'info',
    })

    Reply(embed, interaction, type)
  },
})
