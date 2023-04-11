import { createLocalizedEmbed } from 'commands/reply';
import { DistubeEvents } from 'core/event';

export default new DistubeEvents('error', async (channel, error) => {
	const embed = createLocalizedEmbed({
		title: 'play.error',
		description:
			'An error has occurred while playing music. Please try again later.',
	});

	channel?.send({
		embeds: [embed],
	});
});
