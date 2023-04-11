import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	InteractionType,
} from 'discord.js';
import { replyLocalizedEmbed } from 'commands/reply';
import { Command } from 'core/command';
import { i18n } from 'utils/i18n';
import { getColorValuesFormated } from 'utils/colors';

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
		const input =
			interaction.type === InteractionType.ApplicationCommand
				? interaction.options.get('hexadecimal')?.value?.toString()
				: Array.isArray(args) && args.join(' ');

		if (!input) {
			replyLocalizedEmbed(interaction, type, {
				description: 'hex.invalidDescription',
			});

			return;
		}

		const colorValues = getColorValuesFormated(input);

		if (!colorValues) {
			replyLocalizedEmbed(interaction, type, {
				description: 'hex.invalidDescription',
			});

			return;
		}

		// const embed = Embed({
		// 	title: i18n.__('hex.resultDescription'),
		// 	type: 'success',
		// });

		// embed.addFields({ inline: false, name: 'HEX', value: colorValues.hex });
		// embed.addFields({ inline: false, name: 'RGB', value: colorValues.rgb });
		// embed.addFields({ inline: false, name: 'CMYK', value: colorValues.cmyk });
		// embed.addFields({ inline: false, name: 'HSV', value: colorValues.hsv });
		// // embed.addFields({ inline: false, name: 'HSL', value: colorValues.hsl })

		// Reply(embed, interaction, type);

		replyLocalizedEmbed(
			interaction,
			type,
			{
				title: 'hex.resultDescription',
				fields: [
					{ name: 'hex.hex', value: colorValues.hex },
					{ name: 'hex.rgb', value: colorValues.rgb },
					{ name: 'hex.cmyk', value: colorValues.cmyk },
					{ name: 'hex.hsv', value: colorValues.hsv },
				],
			}
			// { colorValues }
		);
	},
});
