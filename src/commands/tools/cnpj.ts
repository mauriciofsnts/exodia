import { ApplicationCommandType, EmbedBuilder } from 'discord.js';
import { Color, Reply } from 'commands/reply';
import { Command } from 'core/command';
import { i18n } from 'utils/i18n';
import { cnpj } from 'utils/documents';

export default new Command({
	name: 'cnpj',
	description: i18n.__('cnpj.description'),
	type: ApplicationCommandType.ChatInput,
	categorie: '⚙️ Utility',
	aliases: ['cnpj'],
	run: async ({ interaction, type }) => {
		const { mask, output } = cnpj();

		const embed = new EmbedBuilder()
			.setColor(Color.info)
			.setTitle('CNPJ')
			.addFields({ name: i18n.__('cnpj.withMask'), value: mask })
			.addFields({ name: i18n.__('cnpj.withoutMask'), value: output });

		Reply(embed, interaction, type);
	},
});
