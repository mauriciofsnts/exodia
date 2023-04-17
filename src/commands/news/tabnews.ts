import { FieldArray, replyLocalizedEmbed } from 'commands/reply';
import { Command } from 'core/command';
import { i18n } from 'utils/i18n';
import { getTabNews } from 'core/tabnews';
import { UrlShortener } from 'core/URLShortener';

export default new Command({
	name: 'tabnews',
	description: i18n.__('tabnews.description'),
	categorie: '📰 News',
	aliases: ['tabnews'],
	run: async ({ interaction, type }) => {
		getTabNews()
			.then(async (news) => {
				const articles = news.getAll();

				const shortener = new UrlShortener();
				const fields: FieldArray[] = [];

				for (const article of articles) {
					const shortUrl = await shortener.shorten(
						`https://www.tabnews.com.br/${article.owner_username}/${article.slug}`
					);

					fields.push({
						name: article.title,
						value: `⭐ ${article.tabcoins} · ${article.owner_username} · ${shortUrl}`,
						rawValue: true,
					});
				}

				replyLocalizedEmbed(interaction, type, {
					title: 'news.result',
					fields,
					url: 'https://www.tabnews.com.br',
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
