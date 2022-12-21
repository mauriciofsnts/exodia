import { ApplicationCommandType, EmbedBuilder } from 'discord.js'
import { Command } from '../../core/command'
import { cnpj } from '../../utils/documents'
import { Color, Reply } from '../reply'

export default new Command({
  name: 'cnpj',
  description: 'returns random cnpj',
  type: ApplicationCommandType.ChatInput,
  aliases: ['cnpj'],
  run: async ({ interaction, type }) => {
    const { mask, output } = cnpj()

    const embed = new EmbedBuilder()
      .setColor(Color.success)
      .setTitle('CNPJ')
      .addFields({ name: 'With mask', value: mask })
      .addFields({ name: 'Without mask', value: output })

    Reply(embed, interaction, type)
  },
})
