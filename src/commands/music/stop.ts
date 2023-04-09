import { Embed, Reply } from 'commands/reply';
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

		return Reply(
			Embed({
				description: i18n.__mf('stop.result', {
					author: member.nickname,
				}),
				type: 'success',
			}),
			interaction,
			type,
		);
	},
});
