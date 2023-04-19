import i18n from 'i18n';
import { join } from 'path';

// eslint-disable-next-line no-unused-vars
import en from '../locales/en.json';
import ptBr from '../locales/pt_br.json';

i18n.configure({
	locales: ['pt_br', 'en'],
	directory: join(__dirname, '..', 'locales'),
	defaultLocale: 'en',
	retryInDefaultLocale: true,
	objectNotation: true,
	updateFiles: false,

	logWarnFn: function(msg: string) {
		console.log(msg);
	},

	logErrorFn: function(msg) {
		console.error(msg);
	},
});

i18n.setLocale('pt_br');

type LocaleMap = typeof ptBr;

type PathInto<T extends Record<string, any>> = keyof {
	[K in keyof T as T[K] extends string
		? K
		: T[K] extends Record<string, any>
		? `${K & string}.${PathInto<T[K]> & string}`
		: never]: string;
};

type LocaleKey = PathInto<LocaleMap>;

export { i18n, LocaleKey };
