import { replyLocalizedEmbed } from 'commands/reply';
import { Command } from 'core/command';
import { i18n } from 'utils/i18n';
import { hasQueue } from 'validations/audio';
import { isOnVoiceChannel, isOnServer } from 'validations/channel';

export default new Command({
	name: 'pause',
	description: i18n.__('pause.description'),
	categorie: '🎧 Audio',
	aliases: ['ps', 'pause'],
	validations: [isOnVoiceChannel, isOnServer, hasQueue],
	run: async ({ interaction, type, commandParams }) => {
		const { queue, member } = commandParams;

		const paused = queue.pause();

		if (paused) {
			replyLocalizedEmbed(
				interaction,
				type,
				{ description: 'pause.result' },
				{ author: member.nickname ?? '-' },
			);

			return;
		}

		replyLocalizedEmbed(interaction, type, {
			title: 'common.errorCommand',
			description: 'common.errorCommand',
		});
	},
});
