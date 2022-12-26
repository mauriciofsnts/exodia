import { CommandInteractionOptionResolver } from './../../node_modules/discord.js/typings/index.d'
import { ExtendedInteraction } from 'types/command'
import { Events } from 'core/event'
import { client } from 'index'

export default new Events('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return

  await interaction.deferReply()

  const command = client.commands.get(interaction.commandName)
  if (!command) return interaction.followUp('Comando inválido')

  command.run({
    args: interaction.options as CommandInteractionOptionResolver,
    client,
    interaction: interaction as ExtendedInteraction,
    type: 'INTERACTION',
  })
})
