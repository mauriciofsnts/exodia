import { DistubeEvents } from 'core/event'
import { EmbedBuilder } from 'discord.js'

export default new DistubeEvents('playSong', async (queue, song) => {
  const embed = new EmbedBuilder()

  embed.setTitle('🎵 Now playing')
  embed.setDescription(
    `**[${song.name}](${song.url})** \`[${song.formattedDuration}]\``
  )
  embed.setThumbnail(song.thumbnail ?? '')
  embed.setTimestamp()
  embed.setFooter({ text: `Requested by ${song.user?.tag}` })

  queue.textChannel?.send({
    embeds: [embed],
  })
})
