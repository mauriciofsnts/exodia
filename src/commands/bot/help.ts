import { Embed, Reply } from 'commands/reply'
import { Command } from 'core/command'
import { client } from 'index'
import { i18n } from 'utils/i18n'
import { ENVS, loadEnv } from 'utils/envHelper'

export default new Command({
  name: 'help',
  description: i18n.__('help.description'),
  aliases: ['help'],
  categorie: '🤖 Bot',
  run: async ({ interaction, type }) => {
    let commands = client.commands

    let embed = Embed({
      title: i18n.__mf('help.embedTitle', { botname: 'Exodia' }),
      description: i18n.__('help.embedDescription'),
      type: 'info',
    })

    const botPrefix = loadEnv(ENVS.PREFIX)

    commands.forEach((cmd) => {
      const name = `**${botPrefix}${cmd.name} ${
        cmd.aliases ? `(${cmd.aliases})` : ''
      }**`

      const value = `${cmd.description}`

      return embed.addFields({ name, value, inline: true })
    })

    embed.setTimestamp()

    return Reply(embed, interaction, type)
  },
})
