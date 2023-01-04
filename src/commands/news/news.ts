import { client } from 'index'
import { Embed, Reply } from 'commands/reply'
import { Command } from 'core/command'
import { i18n } from 'utils/i18n'
import { getNews } from 'core/news'

export default new Command({
  name: 'news',
  description: i18n.__('news.description'),
  aliases: ['news'],
  run: async ({ interaction, type }) => {
    getNews()
      .then((news) => {
        const articles = news.getAll()

        const embed = Embed({
          title: i18n.__('news.result'),
          type: 'success',
        })

        articles.slice(0, 10).forEach((article) => {
          embed.addFields({
            name: article.title,
            value: `${article.description}\n${article.url}`,
          })
        })

        Reply(embed, interaction, type)
      })
      .catch((error) => {
        console.log('🚀 ~ file: news.ts:31 ~ run: ~ error', error)

        return Reply(
          Embed({
            title: 'Error',
            description: i18n.__('news.error'),
            type: 'error',
          }),
          interaction,
          type
        )
      })
  },
})
