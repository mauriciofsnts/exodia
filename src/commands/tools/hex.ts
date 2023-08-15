import { replyLocalizedEmbed } from 'commands/reply';
import { Command } from 'core/command';
import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
} from 'discord.js';
import { getColorValuesFormated } from 'utils/colors';
import getArgs from 'utils/getArgs';
import { i18n } from 'utils/i18n';

export default new Command({
	name: 'hex',
	description: i18n.__('hex.description'),
	type: ApplicationCommandType.ChatInput,
	categorie: '⚙️ Utility',
	aliases: ['hex'],
	options: [
		{
			name: 'hexadecimal',
			description: 'hexadecimal color',
			type: ApplicationCommandOptionType.String,
			required: true,
		},
	],
	run: async ({ interaction, args, type }) => {
		const input = getArgs(interaction, args, 'hexadecimal');

		if (!input) {
			replyLocalizedEmbed(interaction, type, {
				description: 'hex.invalid',
			});

			return;
		}

		const colorValues = getColorValuesFormated(input);

		if (!colorValues) {
			replyLocalizedEmbed(interaction, type, {
				description: 'hex.invalid',
			});

			return;
		}

		replyLocalizedEmbed(
			interaction,
			type,
			{
				fields: [
					{ name: 'hex.hex', value: colorValues.hex },
					{ name: 'hex.rgb', value: colorValues.rgb },
					{ name: 'hex.cmyk', value: colorValues.cmyk },
					{ name: 'hex.hsv', value: colorValues.hsv },
				],
			},
			// { colorValues }
		);
	},
});
