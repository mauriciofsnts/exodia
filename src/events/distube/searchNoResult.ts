import { DistubeEvents } from 'core/event'
import { EmbedBuilder } from 'discord.js'

export default new DistubeEvents('searchNoResult', async (message, query) => {
  const embed = new EmbedBuilder()

  embed.setTitle('🎵 Not found')
  embed.setDescription(`No result found on YouTube for ${query}`)
  embed.setTimestamp()

  message.channel?.send({
    embeds: [embed],
  })
})
