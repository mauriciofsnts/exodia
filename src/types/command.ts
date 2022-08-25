import {
  ChatInputApplicationCommandData,
  CommandInteraction,
  CommandInteractionOptionResolver,
  GuildMember,
  PermissionResolvable,
} from 'discord.js'
import { ExodiaClient } from '../core/client'

export interface ExtendedInteraction extends CommandInteraction {
  member: GuildMember
}

export type InteractionType = 'INTERACTION' | 'MESSAGE'
interface RunOptions {
  client: ExodiaClient
  interaction: ExtendedInteraction
  args: CommandInteractionOptionResolver
  type: InteractionType
}

type RunFunction = (options: RunOptions) => any

export type CommandType = {
  userPermissions?: PermissionResolvable[]
  run: RunFunction
  aliases: string[]
} & ChatInputApplicationCommandData
