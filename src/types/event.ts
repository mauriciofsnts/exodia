import { ClientEvents } from "discord.js";


export class Events<T extends keyof ClientEvents> {
    constructor(
        public event: T,
        public run: (...args: ClientEvents[T]) => any
    ) {}
}