import { ApplicationCommandType } from 'discord.js'
import { Embed, Reply } from 'commands/reply'
import { Command } from 'core/command'
import { datasource } from 'index'
import Guild from 'entities/guild'

export default new Command({
  name: 'guild-registration',
  description: 'Register server information',
  type: ApplicationCommandType.ChatInput,
  aliases: ['guild-registration'],
  run: async ({ interaction, type }) => {
    if (!interaction.guildId) return

    try {
      const guild = new Guild()
      guild.id = interaction.guildId
      guild.prefix = '%'

      await datasource.manager.save(guild)
    } catch (error) {
      console.error('Error on register guild: ', error)
    }

    Reply(
      Embed({
        title: 'Ok',
        description: 'Registered guild',
        type: 'success',
      }),
      interaction,
      type
    )
  },
})
