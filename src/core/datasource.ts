import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ENVS, loadEnv } from 'utils/envHelper';
import { Guild } from 'discord.js';

export class AppDataSource extends DataSource {
	constructor() {
		const host = loadEnv(ENVS.DB_HOST);
		const database = loadEnv(ENVS.DB_NAME);
		const password = loadEnv(ENVS.DB_PASSWORD);
		const username = loadEnv(ENVS.DB_USER);
		const port = Number(loadEnv(ENVS.DB_PORT));
		const logging = JSON.parse(loadEnv(ENVS.DB_LOGGIN));

		super({
			type: 'postgres',
			username,
			password,
			database,
			port,
			host,
			logging,
			synchronize: true,
			entities: [Guild],
		});
	}
}
