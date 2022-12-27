import { client } from 'index'
import { Embed, Reply } from 'commands/reply'
import { Command } from 'core/command'
import { i18n } from 'utils/i18n'
import { ApplicationCommandOptionType, InteractionType } from 'discord.js'

export default new Command({
  name: 'volume',
  description: i18n.__('skip.description'),
  aliases: ['volume', 'v'],
  options: [
    {
      name: 'value',
      description: 'Use a number between 0 - 100.',
      type: ApplicationCommandOptionType.Number,
      required: true,
    },
  ],
  run: async ({ interaction, args, type }) => {
    if (!interaction.member.voice.channel || !interaction.guild)
      return Reply(
        Embed({
          title: 'Error',
          description: i18n.__('common.errorNotChannel'),
          type: 'error',
        }),
        interaction,
        type
      )

    const queue = client.queues.get(interaction.guild.id)

    if (!queue)
      return Reply(
        Embed({
          title: 'Error',
          description: i18n.__('skip.errorNotQueue'),
          type: 'error',
        }),
        interaction,
        type
      )

    const value =
      interaction.type === InteractionType.ApplicationCommand
        ? String(interaction.options.get('value')?.value)
        : Array.isArray(args) && args.join(' ')

    if (isNaN(Number(value)))
      return Reply(
        Embed({
          title: 'Error',
          description: i18n.__('volume.errorNotNumber'),
          type: 'error',
        }),
        interaction,
        type
      )

    if (Number(value) > 100 || Number(value) < 0)
      return Reply(
        Embed({
          title: 'Error',
          description: i18n.__('volume.errorNotValid'),
          type: 'error',
        }),
        interaction,
        type
      )

    queue.volume = Number(value)
    queue.resource.volume?.setVolumeLogarithmic(Number(value) / 100)

    return Reply(
      Embed({
        description: i18n.__mf('volume.result', {
          arg: Number(value),
        }),
        type: 'success',
      }),
      interaction,
      type
    )
  },
})
