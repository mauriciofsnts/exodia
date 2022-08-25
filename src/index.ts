import { ExodiaClient } from './core/client'
require('dotenv').config()
require('better-logging')(console)

export const client = new ExodiaClient()
client.start()
