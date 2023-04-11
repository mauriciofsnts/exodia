import { ApplicationCommandType } from 'discord.js';
import { replyLocalizedEmbed } from 'commands/reply';
import { Command } from 'core/command';
import { i18n } from 'utils/i18n';
import { uuid } from 'utils/uuid';

export default new Command({
	name: 'uuid',
	description: i18n.__('uuid.description'),
	type: ApplicationCommandType.ChatInput,
	categorie: '⚙️ Utility',
	aliases: ['uuid'],
	run: async ({ interaction, type }) => {
		replyLocalizedEmbed(interaction, type, {
			title: 'uuid.title',
			description: uuid(),
		});
	},
});
