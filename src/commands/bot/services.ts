import { replyLocalizedEmbed } from 'commands/reply';
import { Command } from 'core/command';
import { ApplicationCommandType } from 'discord.js';
import { i18n } from 'utils/i18n';

export default new Command({
	name: 'services',
	description: i18n.__('services.description'),
	type: ApplicationCommandType.ChatInput,
	categorie: '🤖 Bot',
	aliases: ['uptime'],
	run: async ({ interaction, type }) => {
		const kuttDescription =
			'Encurtador de URL que você pode hospedar com análises simples, autenticação e controle de acesso.';
		const kuttUrl = 'https://st.mrzt.dev/';

		const mailDescription = 'Servidor de e-mail padrão';
		const mailUrl = 'https://mail.speedify.dev/';

		const uptimeDescription = 'Uptime Kurma';
		const uptimeUrl = 'https://uptime.mrzt.dev';

		replyLocalizedEmbed(interaction, type, {
			title: 'services.title',
			description: 'services.description',
			fields: [
				{
					name: 'Você pode ver todos os serviços em:',
					value: 'https://github.com/mauriciofsnts',
					rawValue: true,
				},
				{
					name: '\u200b',
					value: ' ',
					rawValue: true,
				},
				{
					name: 'Kutt',
					value: `${kuttDescription} · ${kuttUrl}`,
					rawValue: true,
				},
				{
					name: 'Mail Speedify',
					value: `${mailDescription} · ${mailUrl}`,
					rawValue: true,
				},

				{
					name: 'Uptime Kurma',
					value: `${uptimeDescription} · ${uptimeUrl}`,
					rawValue: true,
				},
			],
		});
	},
});
