import { Embed, Reply } from 'commands/reply'
import { Command } from 'core/command'
import { i18n } from 'utils/i18n'
import { getTabNews } from 'core/tabnews'

export default new Command({
  name: 'tabnews',
  description: i18n.__('tabnews.description'),
  categorie: '📰 News',
  aliases: ['tabnews'],
  run: async ({ interaction, type }) => {
    getTabNews().then((news) => {
      const articles = news.getAll()

      const embed = Embed({
        title: i18n.__('news.result'),
        type: 'success',
      })

      articles.forEach((article) => {
        embed.addFields({
          name: article.title,
          value: `https://www.tabnews.com.br/${article.owner_username}/${article.slug}`,
        })
      })

      Reply(embed, interaction, type)
    })
  },
})
