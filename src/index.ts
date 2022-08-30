import { AppDataSource } from './core/datasource'
import { ExodiaClient } from './core/client'

require('dotenv').config()
require('better-logging')(console)

export const client = new ExodiaClient()
export const datasource = new AppDataSource()

datasource
  .initialize()
  .then(() => {
    // here you can start to work with your database
    console.log('Banco de dados inicializado com sucesso')
  })
  .catch((error) => console.log(error))

client.start()
