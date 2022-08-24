import {
    ApplicationCommandDataResolvable,
    GatewayIntentBits,
    Snowflake,
} from 'discord.js'
import { ClientEvents } from 'discord.js'
import { Events } from './event'
import { Client, Collection } from 'discord.js'
import { ENVS, loadEnv, setupEnvs } from '../helpers/envHelper'
import { RegisterCommandsOptions } from '../types/client'
import { CommandType } from '../types/command'
import { promisify } from 'util'
import { MusicQueue } from './Player'
import glob from 'glob'
import importFile from '../helpers/importFile'

const globPromise = promisify(glob)

export class ExodiaClient extends Client {
    commands: Collection<string, CommandType> = new Collection()
    queues = new Collection<Snowflake, MusicQueue>()

    constructor() {
        super({
            intents: [
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildBans,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildPresences,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMessageReactions,
            ],
        })
    }

    start() {
        setupEnvs()
        this.login(loadEnv(ENVS.BOT_TOKEN))
        this.registerModules()
    }

    async registerCommands({ commands }: RegisterCommandsOptions) {
        this.application?.commands.set(commands)
    }

    async registerModules() {
        const slashCommands: ApplicationCommandDataResolvable[] = []
        // get all commands
        const commandFiles = await globPromise(
            `${__dirname}/../commands/*/*{.ts,.js}`
        )

        //  get each command on folder and set as bot command
        commandFiles.forEach(async (filePath: string) => {
            const command: CommandType = await importFile(filePath)
            if (!command.name) return

            console.info(`command: ${command.name} registered`)

            this.commands.set(command.name, command)
            slashCommands.push(command)
        })

        this.on('ready', () => {
            this.registerCommands({
                commands: slashCommands,
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
