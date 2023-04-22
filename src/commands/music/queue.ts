import { replyLocalizedEmbed } from 'commands/reply';
import { Command } from 'core/command';
import { i18n } from 'utils/i18n';
import { hasQueue } from 'validations/audio';
import { isOnVoiceChannel, isOnServer } from 'validations/channel';

export default new Command({
	name: 'queue',
	description: i18n.__('queue.description'),
	categorie: '🎧 Audio',
	aliases: ['queue'],
	validations: [isOnVoiceChannel, isOnServer, hasQueue],
	run: async ({ interaction, type, commandParams }) => {
		const { queue } = commandParams;

		const tracks = queue.songs.map(
			(song, i) =>
				`**${i + 1}** - [${song.name}](${song.url}) | ${song.formattedDuration}`,
		);

		const songsLength = queue.songs.length;

		replyLocalizedEmbed(interaction, type, {
			description: {
				key: `${tracks.slice(0, 10).join('\n')}\n\n`,
				rawValue: true,
			},
			fields: [
				{
					name: i18n.__('queue.totalSongs'),
					value: `${songsLength}`,
					rawValue: true,
				},
				{
					name: i18n.__('queue.nowplaying'),
					value: `[${queue.songs[0].name}](${queue.songs[0].url}) - ${queue.songs[0].formattedDuration} | Requested by: ${queue.songs[0].user}`,
					rawValue: true,
				},
			],
		});
	},
});
