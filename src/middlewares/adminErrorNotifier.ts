import { EmbedBuilder } from "discord.js";
import type { Middleware } from "@/core/commandBuilder.js";
import { CommandError } from "@/lib/errors.js";

export const adminErrorNotifier: Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    // CommandError is a user-facing validation error — not a system fault, skip notification
    if (!(err instanceof CommandError)) {
      await notifyAdmin(ctx, err).catch(() => {
        // silently ignore — DM failure must not mask the original error
      });
    }

    throw err;
  }
};

async function notifyAdmin(
  ctx: Parameters<Middleware>[0],
  err: unknown,
): Promise<void> {
  const adminId = ctx.bot.config.ADMIN_USER_ID;
  if (!adminId) return;

  const admin = await ctx.bot.client.users.fetch(adminId);

  const errorMessage = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error && err.stack
    ? err.stack.slice(0, 1000)
    : "No stack trace";

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("⚠️ Unhandled command error")
    .addFields(
      { name: "Command", value: `\`${ctx.interaction?.commandName ?? ctx.raw[0] ?? "unknown"}\``, inline: true },
      { name: "Source", value: ctx.source, inline: true },
      { name: "User", value: `<@${ctx.userId}> (${ctx.displayName})`, inline: true },
      {
        name: "Guild",
        value: ctx.guildId
          ? `\`${ctx.bot.client.guilds.cache.get(ctx.guildId)?.name ?? ctx.guildId}\``
          : "DM",
        inline: true,
      },
      { name: "Error", value: `\`\`\`\n${errorMessage}\n\`\`\`` },
      { name: "Stack", value: `\`\`\`\n${stack}\n\`\`\`` },
    )
    .setTimestamp();

  await admin.send({ embeds: [embed] });
}
