import { CommandType } from 'types/command';

export class Command {
	constructor(commandOption: CommandType) {
		Object.assign(this, commandOption);
	}
}
