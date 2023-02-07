import {
  ApplicationCommandDataResolvable,
  GatewayIntentBits,
  Snowflake,
  Client,
  Collection,
  ClientEvents,
} from 'discord.js'

import { MusicQueue } from './player'
import { CommandType } from 'types/command'
import { Events } from './event'
import { RegisterCommandsOptions } from 'types/client'
import { ENVS, loadEnv, setupEnvs } from 'utils/envHelper'

import { promisify } from 'util'
import glob from 'glob'
import importFile from 'utils/importFile'
import { job as newsJob } from 'cron/news'

const globPromise = promisify(glob)

export class ExodiaClient extends Client {
  commands: Collection<string, CommandType> = new Collection()
  queues = new Collection<Snowflake, MusicQueue>()
  dailyNewsRequest = 0

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
    this.registerCrons()
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
      const command: CommandType = await importFile(filePath, true)
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
      const event: Events<keyof ClientEvents> = await importFile(filePath, true)
      this.on(event.event, event.run)
    })
  }

  async registerCrons() {
    newsJob.start()
  }
}
