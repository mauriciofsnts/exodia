import type { Guild } from "discord.js";
import type { BotContext } from "@/core/context";
import { buildCommandPayloads, slashCommands } from "./payload";
import { GLOBAL_SCOPE } from "./repository";

// Records how many slash commands this process currently defines — the source of
// truth every guild's sync state is compared against. Prefix-only commands aren't
// registered with Discord, so they're excluded. Call once at startup.
export async function recordGlobalCommandCount(ctx: BotContext): Promise<void> {
  if (!ctx.commandSync) return;
  await ctx.commandSync.setCount(GLOBAL_SCOPE, slashCommands(ctx.commands).length);
}

// Re-registers this guild's commands if its last-synced count doesn't match
// what the bot currently defines (new commands added since it synced, or it
// never synced at all). No-ops once the guild is up to date.
export async function ensureGuildCommandsSynced(guild: Guild, ctx: BotContext): Promise<void> {
  if (!ctx.commandSync) return;

  const target = slashCommands(ctx.commands).length;
  const synced = await ctx.commandSync.getCount(guild.id);
  if (synced === target) return;

  await guild.commands.set(buildCommandPayloads(ctx.commands));
  await ctx.commandSync.setCount(guild.id, target);
  ctx.logger.info({ guildId: guild.id, from: synced, to: target }, "Synced guild commands");
}
