import i18n from 'i18n';
import { join } from 'path';

import en from '../locales/en.json';
import ptBr from '../locales/pt_br.json';

i18n.configure({
	locales: ['pt_br', 'en'],
	directory: join(__dirname, '..', 'locales'),
	defaultLocale: 'en',
	retryInDefaultLocale: true,
	objectNotation: true,
	updateFiles: false,

	logWarnFn: function (msg: string) {
		console.log(msg);
	},

	logErrorFn: function (msg) {
		console.error(msg);
	},
});

i18n.setLocale('pt_br');

interface BotLocalization {
	ping: {
		description: string;
		result: string;
	};
	skip: {
		description: string;
		errorNotQueue: string;
		result: string;
	};
	common: {
		errorNotChannel: string;
		errorCommand: string;
		errorNotGuild: string;
		errorInvalidParameter: string;
		name: string;
		email: string;
	};
	stop: {
		description: string;
		errorNotQueue: string;
		result: string;
	};
	pause: {
		description: string;
		errorNotQueue: string;
		result: string;
	};
	play: {
		description: string;
		errorNotChannel: string;
		errorNotInSameChannel: string;
		usageReply: string;
		missingPermissionConnect: string;
		missingPermissionSpeak: string;
		cantJoinChannel: string;
		queueEnded: string;
		queueError: string;
		skipSong: string;
		pauseSong: string;
		resumeSong: string;
		unmutedSong: string;
		mutedSong: string;
		decreasedVolume: string;
		increasedVolume: string;
		loopSong: string;
		stopSong: string;
		leaveChannel: string;
		songNotFound: string;
		songAccessErr: string;
		queueAdded: string;
		songTitle: string;
		queueTracksInQueue: string;
		queueTotalDuration: string;
		loading: string;
		nowplaying: string;
		requestBy: string;
	};
	resume: {
		description: string;
		errorNotQueue: string;
		resultNotPlaying: string;
		errorPlaying: string;
	};
	uptime: {
		description: string;
		result: string;
	};
	nowplaying: {
		startedPlaying: string;
		description: string;
		errorNotQueue: string;
		embedTitle: string;
		live: string;
		timeRemaining: string;
		engine: string;
	};
	playlist: {
		description: string;
		usagesReply: string;
		errorNotChannel: string;
		errorNotInSameChannel: string;
		missingPermissionConnect: string;
		missingPermissionSpeak: string;
		errorNotFoundPlaylist: string;
		fetchingPlaylist: string;
		playlistCharLimit: string;
		startedPlaylist: string;
		cantJoinChannel: string;
	};
	lyrics: {
		description: string;
		errorNotQueue: string;
		lyricsNotFound: string;
		embedTitle: string;
	};
	help: {
		description: string;
		embedTitle: string;
		embedDescription: string;
	};
	cnpj: {
		description: string;
		withMask: string;
		withoutMask: string;
	};
	cpf: {
		description: string;
		withMask: string;
		withoutMask: string;
	};
	uuid: {
		description: string;
	};
	volume: {
		description: string;
		errorNotQueue: string;
		errorNotChannel: string;
		currentVolume: string;
		errorNotNumber: string;
		errorNotValid: string;
		result: string;
	};
	news: {
		description: string;
		result: string;
		error: string;
		dailyLimit: string;
	};
	tabnews: {
		description: string;
	};
	people: {
		description: string;
		result: string;
		resultDescription: string;
		password: string;
		birthdate: string;
		footerDisclaimer: string;
	};
	hex: {
		description: string;
		invalid: string;
		result: string;
		resultDescription: string;
	};
	queue: {
		description: string;
		nowplaying: string;
		willPlay: string;
		totalSongs: string;
		requestBy: string;
		playing: string;
		comingNext: string;
	};
	shuffle: {
		description: string;
		result: string;
	};
}

export { i18n };
