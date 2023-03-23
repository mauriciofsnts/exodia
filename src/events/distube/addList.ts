import { DistubeEvents } from 'core/event'
import { i18n } from 'utils/i18n'
import { EmbedBuilder } from 'discord.js'

export default new DistubeEvents('addList', async (queue, song) => {
  const embed = new EmbedBuilder()

  embed.setTitle(i18n.__('play.queueAdded'))
  embed.setColor(0x6875da)
  embed.setDescription(
    `**[${song.name}](${song.url})** \`[${song.formattedDuration}]\``
  )
  embed.setThumbnail(song.thumbnail ?? '')
  embed.setTimestamp()
  embed.setFooter({
    text: i18n.__mf('play.requestBy', { user: song.user?.tag }),
  })

  queue.textChannel?.send({
    embeds: [embed],
  })
})
