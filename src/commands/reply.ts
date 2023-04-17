import { APIEmbedField, EmbedBuilder } from 'discord.js';
import { ExtendedInteraction, InteractionType } from 'types/command';
import i18n from 'i18n';
import { LocaleKey } from 'utils/i18n';

export interface FieldArray extends APIEmbedField {
	rawValue?: boolean;
}
[];

type EmbedOptions = {
	title?: LocaleKey;
	description?: LocaleKey | { key: string; rawValue?: boolean };
	fields?: {
		name: string;
		value: string;
		inline?: boolean;
		rawValue?: boolean;
	}[];
	url?: string;
	footer?: string;
	thumbnail?: string;
};

type ReplaceVars = {
	[key: string]: string;
};

const createLocalizedEmbed = (
	{
		title: titleKey,
		description: descriptionKey,
		fields,
		url,
		footer,
		thumbnail,
	}: EmbedOptions,
	replaceVars?: ReplaceVars
): EmbedBuilder => {
	const embed = new EmbedBuilder();
	embed.setColor(0x6875da);
	embed.setTimestamp();

	if (titleKey) {
		const titleString = i18n.__mf(titleKey, replaceVars);
		embed.setTitle(titleString);
	}

	if (descriptionKey) {
		const descriptionString =
			typeof descriptionKey === 'string'
				? i18n.__mf(descriptionKey, replaceVars)
				: descriptionKey.rawValue
				? descriptionKey.key
				: i18n.__mf(descriptionKey.key, replaceVars);

		embed.setDescription(descriptionString);
	}

	if (fields) {
		fields.forEach(({ name, value, inline, rawValue }) => {
			const nameString = i18n.__mf(name, replaceVars);
			const valueString = rawValue ? value : i18n.__mf(value, replaceVars);

			embed.addFields({ name: nameString, value: valueString, inline: inline });
		});
	}

	if (url) {
		embed.setURL(url);
	}

	if (thumbnail) {
		embed.setThumbnail(thumbnail);
	}

	if (footer) {
		const footerString = i18n.__mf(footer, replaceVars);
		embed.setFooter({ text: footerString });
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

export { createLocalizedEmbed, replyLocalizedEmbed };
