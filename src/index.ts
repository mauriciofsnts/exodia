import { ExodiaClient } from './core/client';
require('dotenv').config()


export const client = new ExodiaClient();
client.start()