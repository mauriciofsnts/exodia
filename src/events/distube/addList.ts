import { DistubeEvents } from 'core/event';
import { createLocalizedEmbed } from 'commands/reply';

export default new DistubeEvents('addList', async (queue, song) => {
	const embed = createLocalizedEmbed(
		{
			title: 'play.queueAdded',
			description: `**[${song.name}](${song.url})** \`[${song.formattedDuration}]\``,
			footer: 'play.requestBy',
			thumbnail: song.thumbnail ?? '',
		},
		{ user: song.user?.tag ?? '-' }
	);

	queue.textChannel?.send({
		embeds: [embed],
	});
});
