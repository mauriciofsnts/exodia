import { Queue } from 'distube'
import { Guild, GuildMember, TextBasedChannel } from 'discord.js'
import { client } from 'index'
import { ExtendedInteraction } from 'types/command'

export type CommandParams = {
  guild: Guild
  channel: TextBasedChannel
  queue: Queue
  member: GuildMember
}

export const buildCommandParams = (
  interaction: ExtendedInteraction
): CommandParams => {
  return {
    guild: interaction.guild as Guild,
    channel: interaction.channel as TextBasedChannel,
    queue: client.distube.getQueue(interaction!.guild!.id) as any,
    member: interaction.member as GuildMember,
  }
}
