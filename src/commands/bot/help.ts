import { replyLocalizedEmbed } from 'commands/reply';
import { Command } from 'core/command';
import { client } from 'index';
import { i18n } from 'utils/i18n';
import { ENVS, loadEnv } from 'utils/envHelper';
import { CommandType } from 'types/command';
import { APIEmbedField } from 'discord.js';

type CommandCategories = {
	[key: string]: CommandType[];
};

export default new Command({
	name: 'help',
	description: i18n.__('help.description'),
	aliases: ['help'],
	categorie: '🤖 Bot',
	run: async ({ interaction, type }) => {
		const commands = client.commands;

		const botPrefix = loadEnv(ENVS.PREFIX);
		const fields: APIEmbedField[] = [];

		const commandCategories = commands.reduce((acc: CommandCategories, cmd) => {
			const categorie = cmd.categorie;

			if (!acc[categorie]) {
				acc[categorie] = [];
			}

			acc[categorie].push(cmd);

			return acc;
		}, {});

		for (const categorie in commandCategories) {
			const cmds = commandCategories[categorie];
			let value = '';

			for (let i = 0; i < cmds.length; i++) {
				const cmd = cmds[i];

				const name = `**${botPrefix}${cmd.name} ${
					cmd.aliases ? `(${cmd.aliases})` : ''
				}**`;

				value += `${name} - ${cmd.description}\n`;

				if (i === cmds.length - 1) {
					value += '\n\n\n';
				}
			}

			fields.push({ name: categorie, value });
		}

		replyLocalizedEmbed(
			interaction,
			type,
			{
				title: 'help.embedTitle',
				description: 'help.embedDescription',
				fields,
			},
			{ botname: 'Exodia' },
		);
	},
});
