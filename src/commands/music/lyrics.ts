import { Command } from 'core/command';
import { i18n } from 'utils/i18n';
import { hasQueue } from 'validations/audio';
import { isOnVoiceChannel, isOnServer } from 'validations/channel';

// @ts-ignore
import lyricsFinder from 'lyrics-finder';
import { replyLocalizedEmbed } from 'commands/reply';

export default new Command({
	name: 'lyrics',
	description: i18n.__('lyrics.description'),
	categorie: '🎧 Audio',
	aliases: ['ly', 'lyrics'],
	validations: [isOnVoiceChannel, isOnServer, hasQueue],
	run: async ({ interaction, type, commandParams }) => {
		const { queue } = commandParams;

		let lyrics = null;
		const title = queue.songs[0].name;

		try {
			lyrics = await lyricsFinder(title, '');
			if (!lyrics) {lyrics = i18n.__mf('lyrics.lyricsNotFound', { title: title });}
		}
		catch (error) {
			lyrics = i18n.__mf('lyrics.lyricsNotFound', { title: title });
		}

		let responseLyrics = lyrics;

		if (lyrics.length >= 2048) responseLyrics = `${lyrics!.substr(0, 2045)}...`;

		replyLocalizedEmbed(
			interaction,
			type,
			{ title: 'lyrics.embedTitle', description: responseLyrics },
			{ title: title ?? '-' },
		);
	},
});
