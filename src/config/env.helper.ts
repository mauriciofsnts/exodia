function logError(msg: string, env: string): void {
    console.error('=========================');
    console.error('=========================');
    console.error(msg, env);
    console.error('=========================');
    console.error('=========================');
}

export function mustLoadEnv(env: string): string {
    const value = process.env[env];

    if (!value) {
        logError('CANNOT LOAD ENV:', env);
        process.exit(1);
    }

    return value;
}

export function loadEnvs(): void {
    console.log('\nLoading envs...')
    mustLoadEnv('BOT_TOKEN')
    mustLoadEnv('GUILD_ID')
    console.log('Envs loaded...\n')
}