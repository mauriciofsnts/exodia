import { ExodiaClient } from '../core/client';
import { PermissionResolvable, ChatInputApplicationCommandData, CommandInteraction, GuildMember, CommandInteractionOptionResolver } from './../../node_modules/discord.js/typings/index.d';

export interface ExtendedInteraction extends CommandInteraction {
    member: GuildMember
}

interface RunOptions {
    client: ExodiaClient,
    interaction: ExtendedInteraction
    args: CommandInteractionOptionResolver | string[]
}

type RunFunction = (options: RunOptions) => any;

export type CommandType = {
    userPermissions?: PermissionResolvable[],
    run: RunFunction
} & ChatInputApplicationCommandData