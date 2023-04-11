import { ApplicationCommandType, EmbedBuilder } from 'discord.js';
import { replyLocalizedEmbed } from 'commands/reply';
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

		replyLocalizedEmbed(interaction, type, {
			title: 'people.result',
			description: 'people.resultDescription',
			fields: [
				{ name: 'common.id', value: uuid() },
				{ name: 'common.name', value: person.name },
				{ name: 'common.email', value: person.email },
				{ name: 'people.password', value: person.password },
				{
					name: 'people.birthdate',
					value: convertDateToDateString(person.birthdate),
				},
				{ name: 'cpf.title', value: cpf().mask },
				{ name: 'rg.title', value: rg().mask },
			],
			footer: 'people.footerDisclaimer',
		});
	},
});
