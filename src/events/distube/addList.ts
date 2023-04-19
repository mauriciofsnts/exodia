import { DistubeEvents } from 'core/event';
import { createLocalizedEmbed } from 'commands/reply';

export default new DistubeEvents('addList', async (queue, song) => {
	const embed = createLocalizedEmbed(
		{
			title: 'play.queueAdded',
			description: {
				key: `**[${song.name}](${song.url})** \`[${song.formattedDuration}]\``,
				rawValue: true,
			},
			footer: 'play.requestBy',
			thumbnail: song.thumbnail ?? '',
		},
		{ user: song.user?.tag ?? '-' },
	);

	queue.textChannel?.send({
		embeds: [embed],
	});
});
