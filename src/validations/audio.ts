import { client } from 'index';
import { ExtendedInteraction, InteractionType } from 'types/command';
import { replyLocalizedEmbed } from 'commands/reply';

const hasQueue = (interaction: ExtendedInteraction, type: InteractionType) => {
	const queue = client.distube.getQueue(interaction!.guild!.id);

	if (!queue || !queue.songs.length) {
		replyLocalizedEmbed(interaction, type, {
			description: 'nowplaying.errorNotQueue',
		});

		return false;
	}

	return true;
};

export { hasQueue };
