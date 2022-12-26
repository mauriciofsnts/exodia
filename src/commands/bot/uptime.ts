import { ApplicationCommandType } from 'discord.js'
import { Embed, Reply } from 'commands/reply'
import { Command } from 'core/command'
import { i18n } from 'utils/i18n'

export default new Command({
  name: 'uptime',
  description: i18n.__('uptime.description'),
  type: ApplicationCommandType.ChatInput,
  aliases: ['uptime'],
  run: async ({ client, interaction, type }) => {
    let seconds = Math.floor(client.uptime! / 1000)
    let minutes = Math.floor(seconds / 60)
    let hours = Math.floor(minutes / 60)
    let days = Math.floor(hours / 24)

    seconds %= 60
    minutes %= 60
    hours %= 24

    const embed = Embed({
      title: 'Uptime',
      description: i18n.__mf('uptime.result', {
        days: days,
        hours: hours,
        minutes: minutes,
        seconds: seconds,
      }),
      type: 'info',
    })

    Reply(embed, interaction, type)
  },
})
