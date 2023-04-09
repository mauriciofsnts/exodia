import { ApplicationCommandType, EmbedBuilder } from 'discord.js';
import { Color, Reply } from 'commands/reply';
import { Command } from 'core/command';
import { i18n } from 'utils/i18n';
import { cpf, rg } from 'utils/documents';
import { convertDateToDateString } from 'utils/dateConvert';
import { faker } from '@faker-js/faker/locale/pt_BR';
import { uuid } from 'utils/uuid';

export function createRandomUser() {
	const name = faker.name.fullName();

	return {
		name,
		userId: faker.datatype.uuid(),
		username: faker.internet.userName(name),
		email: faker.internet.email(name),
		avatar: faker.image.avatar(),
		password: faker.internet.password(),
		birthdate: faker.date.birthdate(),
		registeredAt: faker.date.past(),
	};
}

export default new Command({
	name: 'people',
	description: i18n.__('people.description'),
	type: ApplicationCommandType.ChatInput,
	categorie: '⚙️ Utility',
	aliases: ['people'],
	run: async ({ interaction, type }) => {
		const person = createRandomUser();

		const embed = new EmbedBuilder()
			.setColor(Color.success)
			.setTitle(i18n.__('people.result'))
			.setDescription(i18n.__('people.resultDescription'))
			.setThumbnail(
				'https://api.dicebear.com/5.x/bottts-neutral/png?seed=Socks',
			)
			.addFields({ name: '\u200B', value: '\u200B' })
			.addFields({
				name: 'ID',
				value: uuid(),
			})
			.addFields({
				name: i18n.__('common.name'),
				value: person.name,
			})
			.addFields({
				name: i18n.__('common.email'),
				value: person.email,
			})
			.addFields({
				name: i18n.__('people.password'),
				value: person.password,
			})
			.addFields({
				name: i18n.__('people.birthdate'),
				value: convertDateToDateString(person.birthdate),
				inline: true,
			})
			.addFields({ name: 'CPF', value: cpf().mask, inline: true })
			.addFields({ name: 'RG', value: rg().mask, inline: true })
			.addFields({ name: '\u200B', value: '\u200B' })
			.setFooter({ text: i18n.__('people.footerDisclaimer') });

		Reply(embed, interaction, type);
	},
});
