import { replyLocalizedEmbed } from 'commands/reply';
import { Command } from 'core/command';
import { i18n } from 'utils/i18n';
import { hasQueue } from 'validations/audio';
import { isOnServer, isOnVoiceChannel } from 'validations/channel';

export default new Command({
	name: 'stop',
	description: i18n.__('stop.description'),
	categorie: '🎧 Audio',
	aliases: ['stop'],
	validations: [isOnVoiceChannel, isOnServer, hasQueue],
	run: async ({ interaction, type, commandParams }) => {
		const { member, queue } = commandParams;

		if (queue.songs.length > 0) {
			queue.stop();
		}

		replyLocalizedEmbed(
			interaction,
			type,
			{ description: 'stop.result' },
			{ author: member.nickname ?? '-' },
		);
	},
});
