import { ChatInputApplicationCommandData, CommandInteraction, CommandInteractionOptionResolver, GuildMember, PermissionResolvable } from 'discord.js';
import { ExodiaClient } from '../core/client';

export interface ExtendedInteraction extends CommandInteraction {
    member: GuildMember
}

interface RunOptions {
    client: ExodiaClient,
    interaction: ExtendedInteraction
    args: CommandInteractionOptionResolver
}

export type InteractionType =  "INTERACTION" | "MESSAGE"

type RunFunction = (options: RunOptions, type: InteractionType) => any;

export type CommandType = {
    userPermissions?: PermissionResolvable[],
    run: RunFunction
} & ChatInputApplicationCommandData