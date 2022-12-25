import { client } from '../..'
import { i18n } from '../../utils/i18n'
import { Command } from '../../core/command'
import { Embed, Reply } from '../reply'
import { loadEnv } from '../../utils/envHelper'

export default new Command({
  name: 'help',
  description: i18n.__('help.description'),
  aliases: ['help'],
  run: async ({ interaction, type }) => {
    let commands = client.commands

    let embed = Embed({
      title: i18n.__('help.embedTitle', { botname: 'exodia' }),
      description: i18n.__('help.embedDescription'),
      type: 'info',
    })

    commands.forEach((cmd) => {
      const name = `**${loadEnv('PREFIX')}${cmd.name} ${
        cmd.aliases ? `(${cmd.aliases})` : ''
      }**`

      const value = `${cmd.description}`

      return embed.addFields({ name, value, inline: true })
    })

    embed.setTimestamp()

    return Reply(embed, interaction, type)
  },
})
