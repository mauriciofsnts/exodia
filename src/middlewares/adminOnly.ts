import type { Middleware } from "@/core/commandBuilder";
import { CommandError } from "@/lib/errors";

// Restricts a command to the bot owner (ADMIN_USER_ID) — for operational
// tools, not per-guild permissions like requirePermission. Unset
// ADMIN_USER_ID fails closed: nobody passes.
export const adminOnly: Middleware = async (ctx, next) => {
  if (!ctx.bot.config.ADMIN_USER_ID || ctx.userId !== ctx.bot.config.ADMIN_USER_ID) {
    throw new CommandError(ctx.t("errors.noPermission"));
  }
  await next();
};
