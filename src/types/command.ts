import { ExodiaClient } from 'core/client';
import {
	ChatInputApplicationCommandData,
	CommandInteraction,
	CommandInteractionOptionResolver,
	GuildMember,
	PermissionResolvable,
} from 'discord.js';
import { CommandParams } from 'utils/buildCommandParams';
import { Categorie } from './categories';

export interface ExtendedInteraction extends CommandInteraction {
  member: GuildMember
}

export type InteractionType = 'INTERACTION' | 'MESSAGE'
interface RunOptions {
  client: ExodiaClient
  interaction: ExtendedInteraction
  args: CommandInteractionOptionResolver
  type: InteractionType
  commandParams: CommandParams
}

// eslint-disable-next-line no-unused-vars
type RunFunction = (options: RunOptions) => Promise<void>

export type CommandType = {
  userPermissions?: PermissionResolvable[]
  run: RunFunction
  aliases: string[]
  categorie: Categorie
  validations?: any[]
} & ChatInputApplicationCommandData
