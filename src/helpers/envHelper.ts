

require('better-logging')(console);

export enum ENVS {
    BOT_TOKEN = 'BOT_TOKEN',
    GUILD_ID = 'GUILD_ID',
    PREFIX = 'PREFIX'
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
    console.info('Loading envs...')
    loadEnv(ENVS.BOT_TOKEN)
    loadEnv(ENVS.GUILD_ID)
    loadEnv(ENVS.PREFIX)
}