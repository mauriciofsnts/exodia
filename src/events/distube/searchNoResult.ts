import { DistubeEvents } from 'core/event';
import { EmbedBuilder } from 'discord.js';
import { i18n } from 'utils/i18n';

export default new DistubeEvents('searchNoResult', async (message, query) => {
	const embed = new EmbedBuilder();

	embed.setTitle(i18n.__('play.songNotFound'));
	embed.setDescription(`No result found for ${query}`);
	embed.setTimestamp();

	message.channel?.send({
		embeds: [embed],
	});
});
