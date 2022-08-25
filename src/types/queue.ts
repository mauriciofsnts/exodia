import { VoiceConnection } from '@discordjs/voice'
import { ExtendedInteraction } from './command'

export interface QueueOptions {
  connection: VoiceConnection
  interaction: ExtendedInteraction
}
