import { client } from 'index'
import { Embed, Reply } from 'commands/reply'
import { Command } from 'core/command'
import { i18n } from 'utils/i18n'
import { getNews } from 'core/news'
import { ENVS, loadEnv } from 'utils/envHelper'

export default new Command({
  name: 'news',
  description: i18n.__('news.description'),
  aliases: ['news'],
  run: async ({ interaction, type }) => {
    if (client.dailyNewsRequest === Number(loadEnv(ENVS.DAILY_MAX_REQUESTS))) {
      Reply(
        Embed({
          title: 'Error',
          description: i18n.__('news.dailyLimit'),
          type: 'error',
        }),
        interaction,
        type
      )

      return
    }

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
            value: article?.description
              ? `${article.description}\n${article.url}`
              : article.url,
          })
        })

        client.dailyNewsRequest += 1
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
