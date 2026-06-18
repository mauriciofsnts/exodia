import { createHash } from "node:crypto";
import { EmbedBuilder } from "discord.js";
import type { Middleware } from "@/core/commandBuilder.js";
import type { BotContext } from "@/core/context.js";
import { CommandError, PlayerError } from "@/lib/errors.js";

// How long an identical error signature is suppressed after one DM, so a
// recurring fault (e.g. YouTube down, a broken track on repeat) can't storm the
// admin's inbox.
const THROTTLE_SECONDS = 300;
const MAX_FIELD = 1024; // Discord embed field value limit

// Describes where an error happened, for the admin report. Works for command
// execution, component handlers, and detached playback alike.
export interface AdminErrorContext {
  label: string; // command name, or "player:stream", "component:music", …
  source?: string; // "guild" | "dm" | "playback" | "component"
  userId?: string;
  displayName?: string;
  guildId?: string | null;
  extra?: Record<string, string>; // url, etc.
}

function codeBlock(text: string): string {
  return `\`\`\`\n${text.slice(0, MAX_FIELD - 8)}\n\`\`\``;
}

// DMs the configured admin a structured report of an unhandled error. Throttled
// per error signature and fully best-effort: any failure here must never mask or
// replace the original error.
export async function notifyAdmin(
  bot: BotContext,
  err: unknown,
  context: AdminErrorContext,
): Promise<void> {
  const adminId = bot.config.ADMIN_USER_ID;
  if (!adminId) return;

  const errorMessage = err instanceof Error ? err.message : String(err);

  // Suppress duplicates within the throttle window. Fail open: if the cache is
  // unreachable, still notify rather than swallow the error.
  try {
    const sig = createHash("sha1")
      .update(`${context.label}:${errorMessage}`)
      .digest("hex")
      .slice(0, 16);
    const claimed = await bot.cache.set(`adminerr:${sig}`, "1", "EX", THROTTLE_SECONDS, "NX");
    if (claimed === null) return;
  } catch {
    // cache down — proceed to notify
  }

  const admin = await bot.client.users.fetch(adminId);
  const stack = err instanceof Error && err.stack ? err.stack : "No stack trace";

  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: "Where", value: `\`${context.label}\``, inline: true },
    { name: "Source", value: context.source ?? "n/a", inline: true },
  ];
  if (context.userId) {
    fields.push({
      name: "User",
      value: `<@${context.userId}> (${context.displayName ?? "?"})`,
      inline: true,
    });
  }
  fields.push({
    name: "Guild",
    value: context.guildId
      ? `\`${bot.client.guilds.cache.get(context.guildId)?.name ?? context.guildId}\``
      : "DM",
    inline: true,
  });
  for (const [name, value] of Object.entries(context.extra ?? {})) {
    fields.push({ name, value: `\`${value}\``.slice(0, MAX_FIELD), inline: true });
  }
  fields.push({ name: "Error", value: codeBlock(errorMessage) });
  fields.push({ name: "Stack", value: codeBlock(stack) });

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("⚠️ Unhandled error")
    .addFields(fields)
    .setTimestamp();

  await admin.send({ embeds: [embed] });
}

// Global middleware: routes unexpected errors from command execution to the
// admin. User-facing errors (validation, voice hiccups) aren't system faults.
export const adminErrorNotifier: Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    if (!(err instanceof CommandError) && !(err instanceof PlayerError)) {
      await notifyAdmin(ctx.bot, err, {
        label: ctx.commandName,
        source: ctx.source,
        userId: ctx.userId,
        displayName: ctx.displayName,
        guildId: ctx.guildId,
      }).catch(() => {
        // DM failure must not mask the original error
      });
    }

    throw err;
  }
};
