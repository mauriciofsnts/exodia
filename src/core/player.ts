import { Player } from 'discord-player'
import { client } from '..'

const player = new Player(client, {
  ytdlOptions: {
    quality: 'highestaudio',
    highWaterMark: 1 << 25,
  },
})

export default player
