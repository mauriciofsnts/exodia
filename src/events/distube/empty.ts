import { createLocalizedEmbed } from 'commands/reply';
import { DistubeEvents } from 'core/event';

export default new DistubeEvents('empty', async (queue) => {
	const embed = createLocalizedEmbed({
		title: 'play.queueEnded',
	});

	queue.textChannel?.send({
		embeds: [embed],
	});
});
