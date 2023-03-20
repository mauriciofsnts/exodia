import { ClientEvents } from 'discord.js'
import { DisTubeEvents } from 'distube'

export class Events<T extends keyof ClientEvents> {
  constructor(public event: T, public run: (...args: ClientEvents[T]) => any) {}
}

export class DistubeEvents<T extends keyof DisTubeEvents> {
  constructor(
    public event: T,
    public run: (...args: DisTubeEvents[T]) => any
  ) {}
}
