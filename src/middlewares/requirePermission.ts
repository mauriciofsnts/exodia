import type { PermissionResolvable } from "discord.js";
import type { Middleware } from "@/core/commandBuilder";
import type { TranslationKey } from "@/i18n/index";
import { CommandError } from "@/lib/errors";

// Guards a command behind a Discord permission. Pass a custom i18n key to
// override the generic "no permission" message.
export function requirePermission(
  permission: PermissionResolvable,
  messageKey: TranslationKey = "errors.noPermission",
): Middleware {
  return async (ctx, next) => {
    if (!ctx.memberPermissions?.has(permission)) {
      // messageKey is constrained to parameterless keys by convention; cast past
      // the param-aware t() overload.
      throw new CommandError((ctx.t as (key: TranslationKey) => string)(messageKey));
    }
    await next();
  };
}
