import { MusicQueue } from 'core/player'
import { Guild, GuildMember, TextBasedChannel } from 'discord.js'
import { client } from 'index'
import { ExtendedInteraction } from 'types/command'

export type CommandParams = {
  guild: Guild
  channel: TextBasedChannel
  queue: MusicQueue
  member: GuildMember
}

export const buildCommandParams = (
  interaction: ExtendedInteraction
): CommandParams => {
  return {
    guild: interaction!.guild as Guild,
    channel: interaction!.channel as TextBasedChannel,
    queue: client.queues.get(interaction.guild!.id) as MusicQueue,
    member: interaction.member as GuildMember,
  }
}
