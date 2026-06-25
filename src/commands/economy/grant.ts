import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { createCommand } from "@/core/commandBuilder";
import { CommandError } from "@/lib/errors";
import { resolveUser } from "@/lib/resolveUser";
import { guildOnly } from "@/middlewares/guildOnly";
import { requirePermission } from "@/middlewares/requirePermission";

// Admin tool to seed/adjust the economy. A negative amount removes coins (down to
// zero — we never let a balance go negative). This is the only way coins enter
// circulation for now; poll betting will move them around once it lands.
export default createCommand()
  .setName("grant")
  .setDescription("Give or remove coins from a member (admin)")
  .setPrefix("grant")
  .addOption({
    name: "user",
    description: "Member to grant coins to (mention or ID)",
    type: ApplicationCommandOptionType.String,
    required: true,
  })
  .addOption({
    name: "amount",
    description: "Coins to give (use a negative number to remove)",
    type: ApplicationCommandOptionType.Integer,
    required: true,
  })
  .use(guildOnly)
  .use(requirePermission(PermissionFlagsBits.ManageGuild))
  .execute(async ({ bot, args, guildId, reply, t }) => {
    if (!guildId) throw new CommandError(t("errors.guildOnly"));
    if (!bot.economy) throw new CommandError(t("errors.dbRequired"));

    const amount = args.amount;
    if (!Number.isInteger(amount) || amount === 0)
      throw new CommandError(t("economy.invalidAmount"));

    const target = await resolveUser(bot.client, args.user);
    if (!target) throw new CommandError(t("economy.invalidUser"));

    // Clamp removals so the balance never drops below zero.
    let delta = amount;
    if (delta < 0) {
      const current = await bot.economy.getBalance(guildId, target.id);
      if (current === 0)
        throw new CommandError(
          t("economy.insufficient", { user: `<@${target.id}>`, balance: 0, amount: -delta }),
        );
      delta = Math.max(delta, -current);
    }

    const balance = await bot.economy.adjust(guildId, target.id, delta, "grant");
    const key = delta >= 0 ? "economy.granted" : "economy.removed";
    await reply(t(key, { user: `<@${target.id}>`, amount: Math.abs(delta), balance }));
  })
  .build();
