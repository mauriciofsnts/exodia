import { ExtendedInteraction, InteractionType } from 'types/command';
import { replyLocalizedEmbed } from 'commands/reply';

const isOnVoiceChannel = (
	interaction: ExtendedInteraction,
	type: InteractionType
) => {
	if (!interaction.member?.voice.channel) {
		replyLocalizedEmbed(interaction, type, {
			description: 'common.errorNotChannel',
		});

		return false;
	}

	return true;
};

const isOnServer = (
	interaction: ExtendedInteraction,
	type: InteractionType
) => {
	if (!interaction.guild) {
		replyLocalizedEmbed(interaction, type, {
			description: 'common.errorNotGuild',
		});

		return false;
	}

	return true;
};

export { isOnVoiceChannel, isOnServer };
