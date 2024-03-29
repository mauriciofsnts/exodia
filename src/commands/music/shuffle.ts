import { replyLocalizedEmbed } from 'commands/reply';
import { Command } from 'core/command';
import { i18n } from 'utils/i18n';
import { hasQueue } from 'validations/audio';
import { isOnServer, isOnVoiceChannel } from 'validations/channel';

export default new Command({
	name: 'shuffle',
	description: i18n.__('shuffle.description'),
	categorie: '🎧 Audio',
	aliases: ['shuffle'],
	validations: [isOnServer, isOnVoiceChannel, hasQueue],
	run: async ({ interaction, type, commandParams }) => {
		const { queue } = commandParams;

		if (queue.songs.length > 2) {
			queue.shuffle();
		}

		replyLocalizedEmbed(interaction, type, {
			description: 'shuffle.result',
		});
	},
});
