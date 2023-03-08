import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  InteractionType,
} from 'discord.js'
import { Embed, Reply } from 'commands/reply'
import { Command } from 'core/command'
import { i18n } from 'utils/i18n'

export default new Command({
  name: 'hextorgb',
  description: i18n.__('hexToRgb.description'),
  type: ApplicationCommandType.ChatInput,
  categorie: '⚙️ Utility',
  aliases: ['hex'],
  options: [
    {
      name: 'hexcode',
      description: 'hexadecimal color',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  run: async ({ interaction, args, type }) => {
    const input =
      interaction.type === InteractionType.ApplicationCommand
        ? interaction.options.get('hex')?.value?.toString()
        : Array.isArray(args) && args.join(' ')

    if (!input)
      return Reply(
        Embed({
          description: i18n.__('hexToRgb.invalid'),
          type: 'success',
        }),
        interaction,
        type
      )

    function hexToRGB(hex: string) {
      var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
          }
        : null
    }

    const hex = hexToRGB(input ?? '')

    if (!hex)
      return Reply(
        Embed({
          description: i18n.__('hexToRgb.invalid'),
          type: 'success',
        }),
        interaction,
        type
      )

    const embed = Embed({
      title: i18n.__('hexToRgb.resultDescription'),
      description: i18n.__mf('hexToRgb.result', {
        rgb: `${hex.r}, ${hex.g}, ${hex.b}`,
      }),
      type: 'info',
    })

    Reply(embed, interaction, type)
  },
})
