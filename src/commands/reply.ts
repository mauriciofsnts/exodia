import { ExtendedInteraction } from './../types/command';
import { EmbedBuilder } from "discord.js";
import { InteractionType } from "../types/command";

type EmbedProps = {
    title: string
    thumbnail?: string
    footer?: string
    timestamp?: boolean
    description?: string
    type: 'info' | 'error' | 'success'
}

enum Color {
    success = 0x40ff00,
    error = 0xa71e1e,
    info = 0x34d7ae
}

export function Embed({ title, type, description, footer, thumbnail, timestamp }: EmbedProps): EmbedBuilder {

    const embed = new EmbedBuilder().setColor(Color[type]).setTitle(title)

    if (description)
        embed.setDescription(description)

    if (footer)
        embed.setFooter({ text: footer })

    if (timestamp)
        embed.setTimestamp()

    if (thumbnail)
        embed.setThumbnail(thumbnail)

    return embed;
}

export function Reply(embed: EmbedBuilder, interaction: ExtendedInteraction, type: InteractionType) {

    type === 'MESSAGE' ?
        interaction.reply({ embeds: [embed] }) : interaction.followUp({ embeds: [embed] })

}

