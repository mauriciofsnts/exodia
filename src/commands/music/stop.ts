import { replyLocalizedEmbed } from 'commands/reply';
import { Command } from 'core/command';
import { i18n } from 'utils/i18n';
import { isOnServer, isOnVoiceChannel } from 'validations/channel';
import { hasQueue } from 'validations/audio';

export default new Command({
	name: 'stop',
	description: i18n.__('stop.description'),
	categorie: '🎧 Audio',
	aliases: ['stop'],
	validations: [isOnVoiceChannel, isOnServer, hasQueue],
	run: async ({ interaction, type, commandParams }) => {
		const { member, queue } = commandParams;

		queue.stop();

		replyLocalizedEmbed(
			interaction,
			type,
			{ title: 'stop.title', description: 'stop.result' },
			{ author: member.nickname ?? '-' }
		);
	},
});
