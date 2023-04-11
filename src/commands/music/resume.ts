import { replyLocalizedEmbed } from 'commands/reply';
import { Command } from 'core/command';
import { i18n } from 'utils/i18n';
import { isOnServer, isOnVoiceChannel } from 'validations/channel';
import { hasQueue } from 'validations/audio';

export default new Command({
	name: 'resume',
	description: i18n.__('resume.description'),
	categorie: '🎧 Audio',
	validations: [isOnVoiceChannel, isOnServer, hasQueue],
	aliases: ['resume', 'r'],
	run: async ({ interaction, type, commandParams }) => {
		const { queue, member } = commandParams;

		const unpause = queue.resume();

		if (unpause) {
			replyLocalizedEmbed(
				interaction,
				type,
				{ title: 'resume.title', description: 'resume.result' },
				{ author: member.nickname ?? '-' }
			);

			return;
		}

		replyLocalizedEmbed(interaction, type, {
			title: 'common.errorCommand',
			description: 'common.errorCommand',
		});
	},
});
