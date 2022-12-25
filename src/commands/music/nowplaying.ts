import { client } from '../..'
import { Command } from '../../core/command'
import { i18n } from '../../utils/i18n'
import { Embed, Reply } from '../reply'
import { splitBar } from 'string-progressbar'

export default new Command({
  name: 'nowplaying',
  description: i18n.__('nowplaying.description'),
  aliases: ['np'],
  run: async ({ interaction, type }) => {
    const queue = client.queues.get(interaction.guild!.id)

    if (!queue || !queue.songs.length)
      return Reply(
        Embed({
          title: 'Error',
          description: i18n.__('nowplaying.errorNotQueue'),
          type: 'error',
        }),
        interaction,
        type
      )

    const song = queue.songs[0]
    const seek = queue.resource.playbackDuration / 1000
    const left = song.duration - seek

    const embed = Embed({
      title: i18n.__('nowplaying.embedTitle'),
      description: `${song.title}\n${song.url}`,
      type: 'info',
    })

    if (song.duration > 0) {
      embed.setFooter({
        text: i18n.__mf('nowplaying.timeRemaining', {
          time: new Date(left * 1000).toISOString().substr(11, 8),
        }),
      })

      const fieldValue =
        new Date(seek * 1000).toISOString().substr(11, 8) +
        ' [' +
        splitBar(song.duration == 0 ? seek : song.duration, seek, 20)[0] +
        '] ' +
        (song.duration == 0
          ? ' ◉ LIVE'
          : new Date(song.duration * 1000).toISOString().substr(11, 8))
      false

      console.log('🚀 ~ file: nowplaying.ts:43 ~ run: ~ fieldValue', fieldValue)

      embed.addFields({ name: '\u200b', value: `${fieldValue}` })
    }

    return Reply(embed, interaction, type)
  },
})
