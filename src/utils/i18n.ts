import i18n from 'i18n'
import { join } from 'path'

i18n.configure({
  locales: ['pt_br', 'en'],
  directory: join(__dirname, '..', 'locales'),
  defaultLocale: 'en',
  retryInDefaultLocale: true,
  objectNotation: true,

  logWarnFn: function (msg: string) {
    console.log(msg)
  },

  logErrorFn: function (msg) {
    console.error(msg)
  },
})

i18n.setLocale('pt_br')

export { i18n }
