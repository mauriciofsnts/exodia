import { Command } from "../../../core/command";

export default new Command({
    name: 'connection',
    description: 'returns websocket ping',
    run: async ({ client, interaction }) => {
        interaction.followUp(`${client.ws.ping}ms!`)
    }
})