import { client } from '..'
import { Events } from '../core/event'
import { ENVS, loadEnv } from '../helpers/envHelper'

export default new Events('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const prefix = loadEnv(ENVS.PREFIX)

  if (!message.content.startsWith(prefix)) return

  const [cmd, ...args] = message.content.slice(prefix.length).trim().split(' ')

  const command = client.commands.find(c => c.aliases.includes(cmd))

  if (!command) {
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
