import { Events } from "../core/event";

export default new Events('ready', async () => {
    console.info('Bot online :)')
})