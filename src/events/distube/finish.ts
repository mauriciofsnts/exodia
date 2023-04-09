import { DistubeEvents } from 'core/event';
import { EmbedBuilder } from 'discord.js';
import { i18n } from 'utils/i18n';

export default new DistubeEvents('finish', async (queue) => {
	const embed = new EmbedBuilder();

	embed.setTitle(i18n.__('play.queueEnded'));
	embed.setColor(0xfdd700);
	embed.setTimestamp();

	queue.textChannel?.send({
		embeds: [embed],
	});
});
