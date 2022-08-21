import { ApplicationCommandType, EmbedBuilder } from 'discord.js'
import { Command } from '../../core/command'
import { Embed, Reply } from '../reply'

export default new Command({
    name: 'uptime',
    description: 'Check the uptime',
    type: ApplicationCommandType.ChatInput,
    run: async ({ client, interaction, type }) => {
        let seconds = Math.floor(client.uptime! / 1000)
        let minutes = Math.floor(seconds / 60)
        let hours = Math.floor(minutes / 60)
        let days = Math.floor(hours / 24)

        seconds %= 60
        minutes %= 60
        hours %= 24

        const msg = `Uptime: ${days} day(s), ${hours} hours, ${minutes} minutes, ${seconds} seconds`

        const embed = Embed({
            title: 'Uptime',
            description: msg,
            type: 'info',
        })

        Reply(embed, interaction, type)
    },
})
