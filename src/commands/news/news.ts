import { client } from 'index';
import { FieldArray, replyLocalizedEmbed } from 'commands/reply';
import { Command } from 'core/command';
import { i18n } from 'utils/i18n';
import { getNews } from 'core/newsapi';
import { isMaxNewsRequestsReached } from 'validations/news';
import { UrlShortener } from 'core/URLShortener';

export default new Command({
	name: 'news',
	description: i18n.__('news.description'),
	categorie: '📰 News',
	aliases: ['news'],
	validations: [isMaxNewsRequestsReached],
	run: async ({ interaction, type }) => {
		getNews()
			.then(async (news) => {
				client.dailyNewsRequest += 1;
				const articles = news.getAll();

				const shortener = new UrlShortener();
				const fields: FieldArray[] = [];

				for (const article of articles) {
					const shortUrl = await shortener.shorten(article.url);

					fields.push({
						name: article.title,
						value: article?.description
							? `${article.description}\n${shortUrl}`
							: shortUrl,
						rawValue: true,
					});
				}

				replyLocalizedEmbed(interaction, type, {
					title: 'news.result',
					description: 'news.resultDescription',
					fields,
				});
			})
			.catch((error) => {
				replyLocalizedEmbed(interaction, type, {
					title: 'news.error',
					description: 'news.errorDescription',
				});
			});
	},
});
