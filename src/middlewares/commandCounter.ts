import type { Middleware } from "@/core/commandBuilder";

// Increments a Redis counter for each command executed.
// Keys: `stats:commands:total` and `stats:commands:<name>` — the canonical command
// name from ctx, so slash and prefix invocations land on the same key.
export const commandCounter: Middleware = async (ctx, next) => {
  await next();
  await Promise.all([
    ctx.bot.cache.incr("stats:commands:total"),
    ctx.bot.cache.incr(`stats:commands:${ctx.commandName}`),
  ]);
};
