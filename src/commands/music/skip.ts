import { replyLocalizedEmbed } from 'commands/reply';
import { Command } from 'core/command';
import { i18n } from 'utils/i18n';
import { isOnServer, isOnVoiceChannel } from 'validations/channel';
import { hasQueue } from 'validations/audio';

export default new Command({
	name: 'skip',
	description: i18n.__('skip.description'),
	categorie: '🎧 Audio',
	aliases: ['s', 'skip'],
	validations: [isOnVoiceChannel, isOnServer, hasQueue],
	run: async ({ interaction, type, commandParams }) => {
		const { queue, member } = commandParams;

		queue.skip();

		replyLocalizedEmbed(
			interaction,
			type,
			{ description: 'skip.result' },
			{ author: member.nickname ?? '-' },
		);
	},
});
