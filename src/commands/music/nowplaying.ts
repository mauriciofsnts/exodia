import { Command } from 'core/command';
import { i18n } from 'utils/i18n';
import { splitBar } from 'string-progressbar';
import { Embed, Reply } from 'commands/reply';
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

		const embed = Embed({
			title: i18n.__('nowplaying.embedTitle'),
			description: `${song.name}\n${song.url}`,
			type: 'info',
		});

		if (song.duration > 0) {
			embed.setFooter({
				text: i18n.__mf('nowplaying.timeRemaining', {
					time: new Date(left * 1000).toISOString().substr(11, 8),
				}),
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

			embed.addFields({ name: '\u200b', value: `${fieldValue}` });
		}

		return Reply(embed, interaction, type);
	},
});
