import { CommandInteractionOptionResolver, InteractionType } from 'discord.js';
import { ExtendedInteraction } from 'types/command';

function getArgs(
	interaction: ExtendedInteraction,
	args: CommandInteractionOptionResolver,
	value: string,
): string {
	const input =
		interaction.type === InteractionType.ApplicationCommand
			? interaction.options.get(value)?.value?.toString()
			: Array.isArray(args) && args.join(' ');

	return input ? input : '';
}

export default getArgs;
