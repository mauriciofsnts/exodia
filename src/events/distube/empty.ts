import { DistubeEvents } from 'core/event'

export default new DistubeEvents('empty', async (queue) => {
  queue.textChannel?.send('Queue ended.')
})
