import { replyLocalizedEmbed } from 'commands/reply';
import { Command } from 'core/command';
import { i18n } from 'utils/i18n';
import { ApplicationCommandOptionType, InteractionType } from 'discord.js';
import { hasQueue } from 'validations/audio';
import { isOnVoiceChannel, isOnServer } from 'validations/channel';

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

		const value =
			interaction.type === InteractionType.ApplicationCommand
				? String(interaction.options.get('value')?.value)
				: Array.isArray(args) && args.join(' ');

		if (isNaN(Number(value))) {
			replyLocalizedEmbed(interaction, type, {
				title: 'volume.title',
				description: 'volume.errorNotNumber',
			});

			return;
		}

		if (Number(value) > 100 || Number(value) < 0) {
			replyLocalizedEmbed(interaction, type, {
				title: 'volume.title',
				description: 'volume.errorNotValid',
			});

			return;
		}

		queue.setVolume(Number(value) / 100);

		replyLocalizedEmbed(
			interaction,
			type,
			{
				title: 'volume.title',
				description: 'volume.result',
			},
			{ arg: value ? value : '-' }
		);
	},
});
