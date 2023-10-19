import { faker } from '@faker-js/faker/locale/pt_BR';
import { replyLocalizedEmbed } from 'commands/reply';
import { uuid } from 'utils/uuid';
import { convertDateToDateString } from 'utils/dateConvert';
import { cpf, rg } from 'utils/documents';
import { ExtendedInteraction, InteractionType } from 'types/command';

export function createRandomPerson() {
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

export function replyPersonWithData(
	interaction: ExtendedInteraction,
	type: InteractionType,
) {
	const person = createRandomPerson();

	return replyLocalizedEmbed(interaction, type, {
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
			{ name: 'people.cpf', value: cpf().mask },
			{ name: 'people.rg', value: rg().mask },
		],
		footer: 'people.footerDisclaimer',
	});
}
