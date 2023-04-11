import { ApplicationCommandType } from 'discord.js';
import { Command } from 'core/command';
import { i18n } from 'utils/i18n';
import { replyLocalizedEmbed } from 'commands/reply';

export default new Command({
	name: 'ping',
	description: i18n.__('ping.description'),
	type: ApplicationCommandType.ChatInput,
	categorie: '🤖 Bot',
	aliases: ['ping'],
	run: async ({ client, interaction, type }) => {
		replyLocalizedEmbed(
			interaction,
			type,
			{ title: 'ping.title', description: 'ping.result' },
			{ ping: Math.round(client.ws.ping).toString() }
		);
	},
});
