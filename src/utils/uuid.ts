import { replyLocalizedEmbed } from 'commands/reply';
import { ExtendedInteraction, InteractionType } from 'types/command';

export function uuid(): string {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		const r = (Math.random() * 16) | 0,
			v = c == 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

export function replyUuidWithData(
	interaction: ExtendedInteraction,
	type: InteractionType,
) {
	return replyLocalizedEmbed(interaction, type, {
		title: 'uuid.title',
		description: { key: uuid(), rawValue: true },
	});
}
