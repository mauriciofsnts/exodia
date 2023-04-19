import { createLocalizedEmbed } from 'commands/reply';
import { DistubeEvents } from 'core/event';

export default new DistubeEvents('searchNoResult', async (message) => {
	const embed = createLocalizedEmbed({
		title: 'play.songNotFound',
		description: 'play.songNotFound',
	});

	message.channel?.send({
		embeds: [embed],
	});
});
