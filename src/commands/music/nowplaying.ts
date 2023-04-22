import { Command } from 'core/command';
import { i18n } from 'utils/i18n';
import { splitBar } from 'string-progressbar';
import { replyLocalizedEmbed } from 'commands/reply';
import { hasQueue } from 'validations/audio';
import { isOnVoiceChannel, isOnServer } from 'validations/channel';

export default new Command({
	name: 'nowplaying',
	description: i18n.__('nowplaying.description'),
	categorie: '🎧 Audio',
	aliases: ['np'],
	validations: [isOnVoiceChannel, isOnServer, hasQueue],
	run: async ({ interaction, type, commandParams }) => {
		const { queue } = commandParams;

		const song = queue.songs[0];
		const seek = queue.currentTime;
		const left = song.duration - seek;

		const fields = [];
		let footer = '';

		if (song.duration > 0) {
			footer = i18n.__mf('nowplaying.timeRemaining', {
				time: new Date(left * 1000).toISOString().substr(11, 8),
			});

			const fieldValue =
				new Date(seek * 1000).toISOString().substr(11, 8) +
				' [' +
				splitBar(song.duration == 0 ? seek : song.duration, seek, 20)[0] +
				'] ' +
				(song.duration == 0
					? ' ◉ LIVE'
					: new Date(song.duration * 1000).toISOString().substr(11, 8));
			false;

			fields.push({ name: '\u200b', value: `${fieldValue}`, rawValue: true });
		}

		replyLocalizedEmbed(
			interaction,
			type,
			{
				title: 'nowplaying.embedTitle',
				description: 'nowplaying.result',
				fields,
				footer,
			},
			{ songName: song.name ?? '', songUrl: song.url },
		);
	},
});
