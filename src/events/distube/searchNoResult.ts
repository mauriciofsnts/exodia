import { createLocalizedEmbed } from 'commands/reply';
import { DistubeEvents } from 'core/event';

export default new DistubeEvents('searchNoResult', async (message, query) => {
	const embed = createLocalizedEmbed({
		title: 'play.songNotFound',
		description: `No result found for ${query}`,
	});

	message.channel?.send({
		embeds: [embed],
	});
});
