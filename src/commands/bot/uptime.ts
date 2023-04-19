import { ApplicationCommandType } from 'discord.js';
import { Command } from 'core/command';
import { i18n } from 'utils/i18n';
import { replyLocalizedEmbed } from 'commands/reply';

export default new Command({
	name: 'uptime',
	description: i18n.__('uptime.description'),
	type: ApplicationCommandType.ChatInput,
	categorie: '🤖 Bot',
	aliases: ['uptime'],
	run: async ({ client, interaction, type }) => {
		let seconds = Math.floor(client.uptime! / 1000);
		let minutes = Math.floor(seconds / 60);
		let hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		seconds %= 60;
		minutes %= 60;
		hours %= 24;

		replyLocalizedEmbed(
			interaction,
			type,
			{ title: 'uptime.title', description: 'uptime.result' },
			{
				days: days.toString(),
				hours: hours.toString(),
				minutes: minutes.toString(),
				seconds: seconds.toString(),
			},
		);
	},
});
