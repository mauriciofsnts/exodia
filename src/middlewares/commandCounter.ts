import type { Middleware } from "@/core/commandBuilder";

export const commandCounter: Middleware = async (ctx, next) => {
  await next();
  await Promise.all([
    ctx.bot.cache.incr("stats:commands:total"),
    ctx.bot.cache.incr(`stats:commands:${ctx.commandName}`),
  ]);
};
