import { EmbedBuilder } from 'discord.js';
import { ExtendedInteraction, InteractionType } from 'types/command';
import i18n from 'i18n';

type EmbedOptions = {
	title?: string;
	description?: string;
	fields?: { name: string; value: string; inline?: boolean }[];
};

type ReplaceVars = {
	[key: string]: string;
};

const createLocalizedEmbed = (
	{ title: titleKey, description: descriptionKey, fields }: EmbedOptions,
	replaceVars?: ReplaceVars
): EmbedBuilder => {
	const embed = new EmbedBuilder();
	embed.setColor(0x6875da);

	if (titleKey) {
		const titleString = i18n.__mf(titleKey, replaceVars);
		embed.setTitle(titleString);
	}

	if (descriptionKey) {
		const descriptionString = i18n.__mf(descriptionKey, replaceVars);
		embed.setDescription(descriptionString);
	}

	if (fields) {
		fields.forEach(({ name, value, inline }) => {
			const nameString = i18n.__mf(name, replaceVars);
			const valueString = i18n.__mf(value, replaceVars);

			embed.addFields({ name: nameString, value: valueString, inline: inline });
		});
	}

	return embed;
};

const replyLocalizedEmbed = (
	interaction: ExtendedInteraction,
	type: InteractionType,
	options: EmbedOptions,
	replaceVars?: ReplaceVars
) => {
	const embed = createLocalizedEmbed(options, replaceVars);

	type === 'MESSAGE'
		? interaction.reply({ embeds: [embed] })
		: interaction.followUp({ embeds: [embed] });
};

// ! Example usage:
// replyLocalizedEmbed(interaction, type, {
// 	title: 'ping.title',
// 	description: 'ping.result',
// 	fields: [
// 		{
// 			name: 'ping.field.name',
// 			value: 'ping.field.value',
// 			inline: true,
// 		},
// 	],
// });

export { createLocalizedEmbed, replyLocalizedEmbed };
