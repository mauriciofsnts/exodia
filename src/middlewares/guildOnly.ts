import type { Middleware } from "@/core/commandBuilder";
import { CommandError } from "@/lib/errors";

// Rejects the command when invoked outside a guild (e.g. in DMs).
export const guildOnly: Middleware = async (ctx, next) => {
  if (ctx.source !== "guild" || !ctx.guildId) {
    throw new CommandError(ctx.t("errors.guildOnly"));
  }
  await next();
};
