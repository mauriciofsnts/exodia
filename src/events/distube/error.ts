import { DistubeEvents } from 'core/event'
import { EmbedBuilder } from 'discord.js'

export default new DistubeEvents('error', async (channel, error) => {
  console.error('Error: ' + error)

  const embed = new EmbedBuilder()

  embed.setTitle('🎵 Error')
  embed.setDescription(
    'An error has occurred while playing music. Please try again later.'
  )
  embed.setTimestamp()

  channel?.send({
    embeds: [embed],
  })
})
