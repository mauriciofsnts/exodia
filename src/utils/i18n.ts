import i18n from 'i18n'
import { join } from 'path'

i18n.configure({
  locales: ['pt_br'],
  directory: join(__dirname, '..', 'locales'),
  defaultLocale: 'pt_br',
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