import { ApplicationCommandType, EmbedBuilder } from 'discord.js'
import { Command } from '../../core/command'
import { cpf } from '../../helpers/documents'
import { Color, Reply } from '../reply'

export default new Command({
  name: 'cpf',
  description: 'returns random cpf',
  type: ApplicationCommandType.ChatInput,
  aliases: ['cpf'],
  run: async ({ interaction, type }) => {
    const { mask, output } = cpf()

    const embed = new EmbedBuilder()
      .setColor(Color.success)
      .setTitle('CPF')
      .addFields({ name: 'With mask', value: mask })
      .addFields({ name: 'Without mask', value: output })

    Reply(embed, interaction, type)
  },
})
