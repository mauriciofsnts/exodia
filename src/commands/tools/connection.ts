import { ApplicationCommandType } from 'discord.js'
import { Command } from '../../core/command'

export default new Command({
  name: 'connection',
  description: 'returns websocket ping',
  type: ApplicationCommandType.ChatInput,
  run: async ({ client, interaction }, type) => {
    console.log('type: ', type)

    // if (interaction.isChatInputCommand()) {
    //   interaction.reply(`${client.ws.ping}ms!`)
    // } else {
    //   interaction.followUp(`${client.ws.ping}ms!`)
    // }
  },
})
