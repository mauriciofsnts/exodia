/* eslint-disable no-unused-vars */
export enum ENVS {
	BOT_TOKEN = 'BOT_TOKEN',
	PREFIX = 'PREFIX',
	DB_NAME = 'DB_NAME',
	DB_USER = 'DB_USER',
	DB_PASSWORD = 'DB_PASSWORD',
	DB_HOST = 'DB_HOST',
	DB_PORT = 'DB_PORT',
	DB_LOGGIN = 'DB_LOGGIN',
	NEWSAPI_API_KEY = 'NEWSAPI_API_KEY',
	DAILY_MAX_REQUESTS = 'DAILY_MAX_REQUESTS',
	ADMIN_ID = 'ADMIN_ID',
}

function logError(msg: string, env: string): void {
	console.error('=========================');
	console.error('=========================');
	console.error(msg, env);
	console.error('=========================');
	console.error('=========================');
}

export function loadEnv(env: string): string {
	const value = process.env[env];

	if (!value) {
		logError('CANNOT LOAD ENV:', env);
		process.exit(1);
	}

	return value;
}

export function setupEnvs(): void {
	console.info('Loading envs...');
	loadEnv(ENVS.BOT_TOKEN);
	loadEnv(ENVS.PREFIX);
	loadEnv(ENVS.DB_NAME);
	loadEnv(ENVS.DB_PASSWORD);
	loadEnv(ENVS.DB_USER);
	loadEnv(ENVS.DB_HOST);
	loadEnv(ENVS.DB_PORT);
	loadEnv(ENVS.DB_LOGGIN);
	loadEnv(ENVS.DAILY_MAX_REQUESTS);
	loadEnv(ENVS.NEWSAPI_API_KEY);
	loadEnv(ENVS.ADMIN_ID);
}
