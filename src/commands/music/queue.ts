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

		const q = queue.songs
			.map(
				(song, i) =>
					`${i === 0 ? i18n.__('queue.playing') : `${i}.`} ${song.name} - \`${
						song.formattedDuration
					}\``
			)
			.join('\n');

		const tracks = queue.songs.map(
			(song, i) => `**${i + 1}** - [${song.name}](${song.url}) | ${
				song.formattedDuration
			}       
      ${i18n.__mf('queue.requestedBy', { user: song.user })}
      `
		);

		const songs = queue.songs.length;
		const nextSongs = i18n.__mf('queue.comingNext', { songs: songs });

		replyLocalizedEmbed(interaction, type, {
			description: {
				key: `${tracks.slice(0, 10).join('\n')}\n\n${nextSongs}`,
				rawValue: true,
			},
			fields: [
				{
					name: i18n.__('queue.nowPlaying'),
					value: `[${queue.songs[0].name}](${queue.songs[0].url}) - ${queue.songs[0].formattedDuration} | Requested by: ${queue.songs[0].user}`,
					inline: false,
				},
				{
					name: i18n.__('queue.willPlay'),
					value: queue.formattedDuration,
					inline: true,
				},
				{
					name: i18n.__('queue.totalSongs'),
					value: `${songs}`,
					inline: true,
				},
			],
		});
	},
});
