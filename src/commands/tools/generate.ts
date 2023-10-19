import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	Message,
} from 'discord.js';
import { Command } from 'core/command';
import { i18n } from 'utils/i18n';
import getArgs from 'utils/getArgs';
import { replyLocalizedEmbed } from 'commands/reply';
import {
	replyCnpjWithData,
	replyCpfWithData,
	replyRgWithData,
} from 'utils/documents';
import { replyUuidWithData } from 'utils/uuid';
import { replyPersonWithData } from 'utils/person';
import { ENVS, loadEnv } from 'utils/envHelper';

const modules = ['cnpj', 'cpf', 'rg', 'uuid', 'person'];

export default new Command({
	name: 'generate',
	description: i18n.__('generate.description'),
	type: ApplicationCommandType.ChatInput,
	categorie: '⚙️ Utility',
	aliases: ['generate', 'gen', ...modules],
	options: [
		{
			name: 'tool',
			description: 'Selecione a ferramenta que deseja utilizar',
			type: ApplicationCommandOptionType.String,
			required: true,
			choices: [
				{
					name: 'CNPJ',
					value: 'cnpj',
				},
				{
					name: 'CPF',
					value: 'cpf',
				},
				{
					name: 'RG',
					value: 'rg',
				},
				{
					name: 'UUID',
					value: 'uuid',
				},
				{
					name: 'Person',
					value: 'person',
				},
			],
		},
	],
	run: async ({ interaction, args, type }) => {
		let command;

		if (type === 'MESSAGE') {
			const prefix = loadEnv(ENVS.PREFIX);

			const [cmd] = (interaction as unknown as Message).content
				.slice(prefix.length)
				.trim()
				.split(' ');

			if (modules.includes(cmd)) {
				command = cmd;
			}
		}

		const tool =
			type === 'MESSAGE' && command
				? command
				: getArgs(interaction, args, 'tool');

		if (!tool || !modules.includes(tool)) {
			replyLocalizedEmbed(interaction, type, {
				description: 'generate.invalid',
			});
			return;
		}

		switch (tool) {
		case 'cnpj':
			return replyCnpjWithData(interaction, type);
		case 'cpf':
			return replyCpfWithData(interaction, type);
		case 'rg':
			return replyRgWithData(interaction, type);
		case 'uuid':
			return replyUuidWithData(interaction, type);
		case 'person':
			return replyPersonWithData(interaction, type);
		}
	},
});
