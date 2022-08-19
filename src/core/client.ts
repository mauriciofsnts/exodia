import { ApplicationCommandDataResolvable } from 'discord.js';
import { ClientEvents } from 'discord.js'
import { Events } from './event'
import { Client, Collection, GatewayIntentBits } from 'discord.js'
import { ENVS, loadEnv, setupEnvs } from '../config/env.helper'
import { RegisterCommandsOptions } from '../types/client'
import { CommandType } from '../types/command'
import { promisify } from 'util'
import glob from 'glob'
import importFile from '../config/importFile'

const globPromise = promisify(glob)

export class ExodiaClient extends Client {
    commands: Collection<string, CommandType> = new Collection()

    constructor() {
        super({ intents: [GatewayIntentBits.Guilds] })
    }

    start() {
        setupEnvs()
        this.login(loadEnv(ENVS.BOT_TOKEN))
    }

    async registerCommands({ commands, guildId }: RegisterCommandsOptions) {
        if (guildId) {
            console.log(`Registering commands to guild: ${guildId}`)
            this.guilds.cache.get(guildId)?.commands.set(commands)
        } else {
            console.log('Registering global commands')
            this.application?.commands.set(commands)
        }
    }

    async registerModules() {
        const slashCommands: ApplicationCommandDataResolvable[] = []
        // get all commands
        const commandFiles = await globPromise(
            `${__dirname}/../commands/modules/*/*{.ts,.js}`
        )

        //  get each command on folder and set as bot command
        commandFiles.forEach(async (filePath: string) => {
            const command: CommandType = await importFile(filePath)
            if (!command.name) return

            this.commands.set(command.name, command)
            slashCommands.push(command)
        })

        this.on('ready', () => {
            this.registerCommands({
                commands: slashCommands,
                guildId: loadEnv(ENVS.GUILD_ID),
            })
        })

        // register events
        const eventFiles = await globPromise(`${__dirname}/../events/*{.ts,.js}`)
        eventFiles.forEach(async (filePath) => {
            const event: Events<keyof ClientEvents> = await importFile(filePath)

            this.on(event.event, event.run)
        })
    }
}
