import { DistubeEvents } from 'core/event'
import { EmbedBuilder } from 'discord.js'

export default new DistubeEvents('finish', async (queue) => {
  const embed = new EmbedBuilder()

  embed.setTitle('🎵 Queue ended')
  embed.setDescription('The queue has ended.')
  embed.setTimestamp()

  queue.textChannel?.send({
    embeds: [embed],
  })
})
