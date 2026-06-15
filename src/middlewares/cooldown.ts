import type { Middleware } from "@/core/commandBuilder.js";
import { CommandError } from "@/lib/errors.js";

// Per-user, per-command cooldown backed by Redis, so it survives restarts and
// holds across shards. Uses SET NX EX for an atomic claim of the window.
export function cooldown(seconds: number): Middleware {
  return async (ctx, next) => {
    const key = `cooldown:${ctx.commandName}:${ctx.userId}`;
    const claimed = await ctx.bot.cache.set(key, "1", "EX", seconds, "NX");

    if (claimed === null) {
      const remaining = await ctx.bot.cache.ttl(key);
      throw new CommandError(ctx.t("errors.cooldown", { seconds: Math.max(remaining, 1) }));
    }

    await next();
  };
}
