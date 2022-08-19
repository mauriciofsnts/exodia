import { ApplicationCommandType } from "discord.js";
import { Command } from "../../core/command";

export default new Command({
    name: 'connection',
    description: 'returns websocket ping',
    type: ApplicationCommandType.ChatInput,
    run: async ({ client, interaction, ...rest }) => {
        console.log(rest)
        interaction.followUp(`${client.ws.ping}ms!`)
    }
})