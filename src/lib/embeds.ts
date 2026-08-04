import { EmbedBuilder } from "discord.js";

export const EmbedColor = {
  primary: 0x5865f2,
  success: 0x57f287,
  warning: 0xfee75c,
  danger: 0xed4245,
  music: 0x5865f2,
  sports: 0x2ecc71,
  freegames: 0x9b59b6,
} as const;

export function embed(color: number = EmbedColor.primary): EmbedBuilder {
  return new EmbedBuilder().setColor(color);
}
