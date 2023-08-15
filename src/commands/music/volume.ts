import { replyLocalizedEmbed } from 'commands/reply';
import { Command } from 'core/command';
import { ApplicationCommandOptionType } from 'discord.js';
import getArgs from 'utils/getArgs';
import { i18n } from 'utils/i18n';
import { hasQueue } from 'validations/audio';
import { isOnServer, isOnVoiceChannel } from 'validations/channel';

export default new Command({
	name: 'volume',
	description: i18n.__('volume.description'),
	categorie: '🎧 Audio',
	aliases: ['volume', 'v'],
	validations: [isOnVoiceChannel, isOnServer, hasQueue],
	options: [
		{
			name: 'value',
			description: 'Use a number between 0 - 100.',
			type: ApplicationCommandOptionType.Number,
			required: true,
		},
	],
	run: async ({ interaction, args, type, commandParams }) => {
		const { queue } = commandParams;

		const value = getArgs(interaction, args, 'value');

		if (isNaN(Number(value))) {
			replyLocalizedEmbed(interaction, type, {
				description: 'volume.errorNotNumber',
			});

			return;
		}

		if (Number(value) > 100 || Number(value) < 0) {
			replyLocalizedEmbed(interaction, type, {
				description: 'volume.errorNotValid',
			});

			return;
		}

		queue.setVolume(Number(value) / 100);

		replyLocalizedEmbed(
			interaction,
			type,
			{
				description: 'volume.result',
			},
			{ arg: value ? value : '-' },
		);
	},
});
