import { Embed, Reply } from 'commands/reply'
import { Command } from 'core/command'
import { client } from 'index'
import { i18n } from 'utils/i18n'

// @ts-ignore
import lyricsFinder from 'lyrics-finder'

export default new Command({
  name: 'lyrics',
  description: i18n.__('lyrics.description'),
  aliases: ['ly'],
  run: async ({ interaction, type }) => {
    const queue = client.queues.get(interaction.guild!.id)

    if (!queue)
      return Reply(
        Embed({
          title: 'Error',
          description: i18n.__('lyrics.errorNotQueue'),
          type: 'error',
        }),
        interaction,
        type
      )

    let lyrics = null
    const title = queue.songs[0].title

    try {
      lyrics = await lyricsFinder(queue.songs[0].title, '')
      if (!lyrics) lyrics = i18n.__mf('lyrics.lyricsNotFound', { title: title })
    } catch (error) {
      console.log('🚀 ~ file: lyrics.ts:34 ~ run: ~ error', error)
      lyrics = i18n.__mf('lyrics.lyricsNotFound', { title: title })
    }

    let responseLyrics = lyrics

    if (lyrics.length >= 2048) responseLyrics = `${lyrics!.substr(0, 2045)}...`

    let embed = Embed({
      title: i18n.__mf('lyrics.embedTitle', { title: title }),
      description: responseLyrics,
      type: 'info',
    })

    return Reply(embed, interaction, type)
  },
})
