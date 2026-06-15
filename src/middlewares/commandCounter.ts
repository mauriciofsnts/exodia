import type { Middleware } from "@/core/commandBuilder.js";

// Increments a Redis counter for each command executed.
// Keys: `stats:commands:total` and `stats:commands:<name>`
export const commandCounter: Middleware = async (ctx, next) => {
  await next();
  await Promise.all([
    ctx.bot.cache.incr("stats:commands:total"),
    ctx.bot.cache.incr(
      `stats:commands:${ctx.bot.client.user?.id ?? "unknown"}:${getCommandName(ctx)}`,
    ),
  ]);
};

function getCommandName(ctx: Parameters<Middleware>[0]): string {
  return ctx.interaction?.commandName ?? ctx.message?.content.split(" ")[0] ?? "unknown";
}
