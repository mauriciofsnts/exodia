import { createLocalizedEmbed } from 'commands/reply';
import { DistubeEvents } from 'core/event';

export default new DistubeEvents('error', async (channel) => {
	const embed = createLocalizedEmbed({
		title: 'play.error',
		description: 'common.errorGenericMusic',
	});

	channel?.send({
		embeds: [embed],
	});
});
