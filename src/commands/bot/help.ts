import { Embed, Reply } from 'commands/reply'
import { Command } from 'core/command'
import { client } from 'index'
import { i18n } from 'utils/i18n'
import { ENVS, loadEnv } from 'utils/envHelper'
import { CommandType } from 'types/command'

type CommandCategories = {
  [key: string]: CommandType[]
}

export default new Command({
  name: 'help',
  description: i18n.__('help.description'),
  aliases: ['help'],
  categorie: '🤖 Bot',
  run: async ({ interaction, type }) => {
    let commands = client.commands

    let embed = Embed({
      title: i18n.__mf('help.embedTitle', { botname: 'Exodia' }),
      type: 'info',
    })

    const botPrefix = loadEnv(ENVS.PREFIX)

    const commandCategories = commands.reduce((acc: CommandCategories, cmd) => {
      const categorie = cmd.categorie

      if (!acc[categorie]) {
        acc[categorie] = []
      }

      acc[categorie].push(cmd)

      return acc
    }, {})

    for (const categorie in commandCategories) {
      const commands = commandCategories[categorie]
      let value = ''

      for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i]

        const name = `**${botPrefix}${cmd.name} ${
          cmd.aliases ? `(${cmd.aliases})` : ''
        }**`

        value += `${name} - ${cmd.description}\n`

        if (i === commands.length - 1) {
          value += '\n\n\n'
        }
      }

      embed.addFields({ name: categorie, value })
    }
    embed.setTimestamp()

    return Reply(embed, interaction, type)
  },
})
