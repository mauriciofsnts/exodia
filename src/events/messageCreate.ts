import { Events } from 'core/event';
import { client } from 'index';
import { buildCommandParams } from 'utils/buildCommandParams';
import { ENVS, loadEnv } from 'utils/envHelper';
import { sendErrorToAdmin } from 'utils/sendErrorToAdmin';

export default new Events('messageCreate', async (message) => {
	if (message.author.bot || !message.guild) return;

	const prefix = loadEnv(ENVS.PREFIX);

	if (!message.content.startsWith(prefix)) return;

	const [cmd, ...args] = message.content.slice(prefix.length).trim().split(' ');

	const command = client.commands.find((c) => c.aliases.includes(cmd));

	if (!command) return;

	if (command.validations) {
		const valid = command.validations.every((validation) =>
			validation(message, 'MESSAGE'),
		);
		if (!valid) {
			return;
		}
	}

	command
		.run({
			args: args as any,
			client,
			interaction: message as any,
			type: 'MESSAGE',
			commandParams: buildCommandParams(message as any),
		})
		.catch((error) => {
			sendErrorToAdmin(error, command.name, args);

			message.reply({
				content: 'There was an error while executing this command!',
			});
		});
});
