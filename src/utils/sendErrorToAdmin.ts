import { ENVS, loadEnv } from './envHelper';
import { client } from 'index';

async function sendErrorToAdmin<T>(
	error: T,
	command: string,
	parameters?: string[],
) {
	const user = await client.users.fetch(loadEnv(ENVS.ADMIN_ID));

	if (!user) {
		console.error('Admin user not found');
		console.error(error);
		return;
	}

	const errorMessage = error instanceof Error ? error.message : String(error);

	const messageWithParameters = `There was an error while executing the command \`${command}\` with the parameters \`${parameters?.join(
		', ',
	)}\`:\n\`\`\`${errorMessage}\`\`\``;

	const messageWithoutParameters = `There was an error while executing the command \`${command}\`:\n\`\`\`${errorMessage}\`\`\``;

	user.send({
		content: parameters?.length
			? messageWithParameters
			: messageWithoutParameters,
	});
}

export { sendErrorToAdmin };
