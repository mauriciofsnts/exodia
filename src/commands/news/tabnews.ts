import { Embed, Reply } from 'commands/reply';
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
		getTabNews().then(async (news) => {
			const articles = news.getAll();
			const shortener = new UrlShortener();

			const embed = Embed({
				title: i18n.__('news.result'),
				type: 'success',
			});

			for (const article of articles) {
				const shortUrl = await shortener.shorten(
					`https://www.tabnews.com.br/${article.owner_username}/${article.slug}`,
				);

				embed.addFields({
					name: article.title,
					value: `⭐ ${article.tabcoins} · ${article.owner_username} · ${shortUrl}`,
				});
			}

			embed.setURL('https://www.tabnews.com.br');
			embed.setTimestamp();
			Reply(embed, interaction, type);
		});
	},
});
