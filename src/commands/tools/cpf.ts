import { ApplicationCommandType, EmbedBuilder } from 'discord.js';
import { replyLocalizedEmbed } from 'commands/reply';
import { Command } from 'core/command';
import { i18n } from 'utils/i18n';
import { cpf } from 'utils/documents';

export default new Command({
	name: 'cpf',
	description: i18n.__('cpf.description'),
	type: ApplicationCommandType.ChatInput,
	categorie: '⚙️ Utility',
	aliases: ['cpf'],
	run: async ({ interaction, type }) => {
		const { mask, output } = cpf();

		// const embed = new EmbedBuilder()
		// 	.setColor(Color.info)
		// 	.setTitle('CPF')
		// 	.addFields({ name: i18n.__('cpf.withMask'), value: mask })
		// 	.addFields({ name: i18n.__('cpf.withoutMask'), value: output });

		// Reply(embed, interaction, type);

		replyLocalizedEmbed(
			interaction,
			type,
			{
				title: 'cpf.title',
				description: 'cpf.result',
				fields: [
					{ name: 'cpf.withMask', value: mask },
					{ name: 'cpf.withoutMask', value: output },
				],
			},
			{ mask, output }
		);
	},
});
