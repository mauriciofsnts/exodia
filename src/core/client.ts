import {
	ApplicationCommandDataResolvable,
	GatewayIntentBits,
	Client,
	Collection,
	ClientEvents,
} from 'discord.js';

import { CommandType } from 'types/command';
import { DistubeEvents as ClientDistubeEvents, Events } from './event';
import { RegisterCommandsOptions } from 'types/client';
import { ENVS, loadEnv, setupEnvs } from 'utils/envHelper';

import { promisify } from 'util';
import glob from 'glob';
import importFile from 'utils/importFile';
import { job as newsJob } from 'cron/news';

import { DisTube, DisTubeEvents } from 'distube';
import { YtDlpPlugin } from '@distube/yt-dlp';
import { SoundCloudPlugin } from '@distube/soundcloud';
import SpotifyPlugin from '@distube/spotify';

const globPromise = promisify(glob);

export class ExodiaClient extends Client {
	commands: Collection<string, CommandType> = new Collection();

	dailyNewsRequest = 0;

	distube = new DisTube(this, {
		leaveOnStop: true,
		emitNewSongOnly: true,
		emitAddSongWhenCreatingQueue: false,
		emitAddListWhenCreatingQueue: false,
		leaveOnFinish: true,
		plugins: [
			new YtDlpPlugin(),
			new SoundCloudPlugin(),
			new SpotifyPlugin({
				emitEventsAfterFetching: true,
			}),
		],
	});

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
		});
	}

	start() {
		setupEnvs();
		this.login(loadEnv(ENVS.BOT_TOKEN));
		this.registerModules();
		this.registerCrons();
	}

	async registerCommands({ commands }: RegisterCommandsOptions) {
		this.application?.commands.set(commands);
	}

	async registerModules() {
		const slashCommands: ApplicationCommandDataResolvable[] = [];
		// get all commands
		const commandFiles = await globPromise(
			`${__dirname}/../commands/*/*{.ts,.js}`
		);

		//  get each command on folder and set as bot command
		commandFiles.forEach(async (filePath: string) => {
			const command: CommandType = await importFile(filePath, true);
			if (!command.name) return;

			console.info(`command: ${command.name} registered`);

			this.commands.set(command.name, command);
			slashCommands.push(command);
		});

		this.on('ready', () => {
			this.registerCommands({
				commands: slashCommands,
			});
		});

		// register events
		const eventFiles = await globPromise(`${__dirname}/../events/*{.ts,.js}`);

		eventFiles.forEach(async (filePath) => {
			const event: Events<keyof ClientEvents> = await importFile(
				filePath,
				true
			);
			this.on(event.event, event.run);
		});

		// register distube events
		const distubeEventFiles = await globPromise(
			`${__dirname}/../events/distube/*{.ts,.js}`
		);

		distubeEventFiles.forEach(async (filePath) => {
			const event: ClientDistubeEvents<keyof DisTubeEvents> = await importFile(
				filePath,
				true
			);
			this.distube.on(event.event, event.run);
		});
	}

	async registerCrons() {
		newsJob.start();
	}
}
