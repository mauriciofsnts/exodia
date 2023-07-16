import { CommandInteractionOptionResolver } from './../../node_modules/discord.js/typings/index.d';
import { ExtendedInteraction } from 'types/command';
import { Events } from 'core/event';
import { client } from 'index';
import { buildCommandParams } from 'utils/buildCommandParams';
import { sendErrorToAdmin } from 'utils/sendErrorToAdmin';

export default new Events('interactionCreate', async (interaction) => {
	if (!interaction.isCommand()) return;

	await interaction.deferReply();

	const command = client.commands.get(interaction.commandName);
	if (!command) return interaction.followUp('Invalid command');

	if (command.validations) {
		const valid = command.validations.every((validation) =>
			validation(interaction, 'INTERACTION'),
		);
		if (!valid) {
			return;
		}
	}

	command
		.run({
			args: interaction.options as CommandInteractionOptionResolver,
			client,
			interaction: interaction as ExtendedInteraction,
			type: 'INTERACTION',
			commandParams: buildCommandParams(interaction as ExtendedInteraction),
		})
		.catch((error) => {
			sendErrorToAdmin(error, command.name);

			interaction.followUp({
				content: 'There was an error while executing this command!',
				ephemeral: true,
			});
		});
});
