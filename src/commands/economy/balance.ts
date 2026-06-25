import { ApplicationCommandOptionType } from "discord.js";
import { createCommand } from "@/core/commandBuilder";
import { CommandError } from "@/lib/errors";
import { resolveUser } from "@/lib/resolveUser";
import { guildOnly } from "@/middlewares/guildOnly";

// Shows a member's coin balance — your own by default, or someone else's when a
// user is passed.
export default createCommand()
  .setName("balance")
  .setDescription("Check your coin balance (or another member's)")
  .setPrefix("balance")
  .addOption({
    name: "user",
    description: "Member to check (defaults to you)",
    type: ApplicationCommandOptionType.String,
    required: false,
  })
  .use(guildOnly)
  .execute(async ({ bot, args, guildId, userId, reply, t }) => {
    if (!guildId) throw new CommandError(t("errors.guildOnly"));
    if (!bot.economy) throw new CommandError(t("errors.dbRequired"));

    const target = args.user ? await resolveUser(bot.client, args.user) : null;
    if (args.user && !target) throw new CommandError(t("economy.invalidUser"));

    const id = target?.id ?? userId;
    const balance = await bot.economy.getBalance(guildId, id);

    if (target) await reply(t("economy.balanceOther", { user: `<@${id}>`, balance }));
    else await reply(t("economy.balanceSelf", { balance }));
  })
  .build();
