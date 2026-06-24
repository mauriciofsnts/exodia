import type { Guild } from "discord.js";
import type { BotContext } from "@/core/context";
import { buildDesiredCommands, signaturesEqual } from "./payload";

// Brings a guild's registered slash commands in line with what the bot defines,
// touching only what changed: it creates commands missing from the guild,
// updates the ones whose shape drifted, and deletes the ones the bot no longer
// defines. The recorded signatures act as a fast path — when they already match
// what we'd register, we skip the Discord round trip entirely.
export async function ensureGuildCommandsSynced(guild: Guild, ctx: BotContext): Promise<void> {
  if (!ctx.commandSync) return;

  const desired = buildDesiredCommands(ctx.commands);
  const desiredSigs = new Map(desired.map((cmd) => [cmd.name, cmd.signature]));

  const recorded = await ctx.commandSync.getSignatures(guild.id);
  if (signaturesEqual(recorded, desiredSigs)) return; // already in sync

  // Reconcile against what Discord actually has, so we catch commands removed or
  // edited out-of-band too (and learn each existing command's id for edit/delete).
  const existing = await guild.commands.fetch();
  const existingByName = new Map([...existing.values()].map((cmd) => [cmd.name, cmd]));
  const desiredNames = new Set(desiredSigs.keys());

  let created = 0;
  let updated = 0;
  let removed = 0;

  for (const cmd of desired) {
    const live = existingByName.get(cmd.name);
    if (!live) {
      await guild.commands.create(cmd.payload);
      created++;
    } else if (recorded.get(cmd.name) !== cmd.signature) {
      // Shape changed (or never recorded for this guild) — push the new shape.
      await guild.commands.edit(live.id, cmd.payload);
      updated++;
    }
  }

  // Remove commands registered on the guild that the bot no longer defines.
  for (const live of existing.values()) {
    if (!desiredNames.has(live.name)) {
      await guild.commands.delete(live.id);
      removed++;
    }
  }

  await ctx.commandSync.saveSignatures(guild.id, desiredSigs);
  ctx.logger.info({ guildId: guild.id, created, updated, removed }, "Synced guild commands");
}
