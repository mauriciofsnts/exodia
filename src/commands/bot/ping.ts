import { ApplicationCommandType } from 'discord.js';
import { Embed, Reply } from 'commands/reply';
import { Command } from 'core/command';
import { i18n } from 'utils/i18n';

export default new Command({
	name: 'ping',
	description: i18n.__('ping.description'),
	type: ApplicationCommandType.ChatInput,
	categorie: '🤖 Bot',
	aliases: ['ping'],
	run: async ({ client, interaction, type }) => {
		const embed = Embed({
			title: 'Ping',
			description: i18n.__mf('ping.result', {
				ping: Math.round(client.ws.ping),
			}),
			type: 'info',
		});

		Reply(embed, interaction, type);
	},
});
