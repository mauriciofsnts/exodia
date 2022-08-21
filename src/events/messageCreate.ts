import { client } from '..'
import { Events } from '../core/event'
import { ENVS, loadEnv } from '../helpers/envHelper'

export default new Events('messageCreate', async (message) => {
  if (message.author.bot) return

  const prefix = loadEnv(ENVS.PREFIX)
  if (!message.content.startsWith(prefix)) return

  const [cmd, ...args] = message.content.slice(prefix.length).trim().split(' ')

  const command = client.commands.get(cmd.toLowerCase())

  if (!command) {
    console.error(`command ${cmd.toLowerCase()} not found`)
    return
  }

  try {
    command.run({
      args: args as any,
      client,
      interaction: message as any,
      type: 'MESSAGE'
    })
  } catch (error) {
    console.error(`Error on execute command ${cmd.toLowerCase()}: `, error)
  }
})
