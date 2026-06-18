import { EmbedBuilder } from "discord.js";

// Shared palette so every embed across the bot stays visually consistent.
export const EmbedColor = {
  primary: 0x5865f2, // Discord blurple — default / informational
  success: 0x57f287, // confirmations
  warning: 0xfee75c,
  danger: 0xed4245,
  music: 0x5865f2,
  sports: 0x2ecc71,
} as const;

// Base embed factory — pick a palette color and start building.
export function embed(color: number = EmbedColor.primary): EmbedBuilder {
  return new EmbedBuilder().setColor(color);
}
