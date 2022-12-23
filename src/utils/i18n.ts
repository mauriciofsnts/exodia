import i18n from 'i18n'
import { join } from 'path'

import en from '../locales/en.json'
import ptBr from '../locales/pt_br.json'

i18n.configure({
  locales: ['pt_br', 'en'],
  directory: join(__dirname, "..", "locales"),
  defaultLocale: 'en',
  retryInDefaultLocale: true,
  objectNotation: true,
  updateFiles: true,

  logWarnFn: function (msg: string) {
    console.log(msg)
  },

  logErrorFn: function (msg) {
    console.error(msg)
  },
})

i18n.setLocale('pt_br')

export { i18n }
