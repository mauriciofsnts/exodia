import { Embed, Reply } from 'commands/reply'
import { Command } from 'core/command'
import { hasQueue } from 'validations/audio'
import { isOnServer, isOnVoiceChannel } from 'validations/channel'

export default new Command({
  name: 'shuffle',
  description: 'Shuffle the queue',
  categorie: '🎧 Audio',
  aliases: ['shuffle'],
  validations: [isOnServer, isOnVoiceChannel, hasQueue],
  run: async ({ interaction, type, commandParams }) => {
    const { queue } = commandParams

    queue.shuffle()

    return Reply(
      Embed({
        description: `Queue shuffled`,
        type: 'success',
      }),
      interaction,
      type
    )
  },
})
