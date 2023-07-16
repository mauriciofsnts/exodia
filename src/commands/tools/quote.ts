import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	InteractionType,
} from 'discord.js';
import { Command } from 'core/command';
import { i18n } from 'utils/i18n';
import { QuoteGenerator } from 'core/quoteGenerator';

export default new Command({
	name: 'quote',
	description: i18n.__('quote.description'),
	type: ApplicationCommandType.ChatInput,
	categorie: '⚙️ Utility',
	aliases: ['quote'],
	options: [
		{
			name: 'quote',
			description: 'A message to quote',
			type: ApplicationCommandOptionType.String,
			required: true,
		},
	],
	run: async ({ interaction, args }) => {
		const input =
			interaction.type === InteractionType.ApplicationCommand
				? interaction.options.get('quote')?.value?.toString()
				: Array.isArray(args) && args.join(' ');

		if (!input) return;

		const generator = new QuoteGenerator();

		const image = await generator.createImageWithText(input);
		if (!image) return console.log('Cannot create image');

		const imagebuff = await image.getBufferAsync('image/png');

		interaction.channel?.send({
			files: [{ attachment: imagebuff, name: 'quote.png' }],
		});
	},
});
