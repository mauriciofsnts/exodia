import { PermissionFlagsBits } from "discord.js";
import { createCommand } from "@/core/commandBuilder";
import { CommandError } from "@/lib/errors";
import { guildOnly } from "@/middlewares/guildOnly";
import { requirePermission } from "@/middlewares/requirePermission";
import { handleSportsubComponent, sportStep } from "@/services/sports/sportsubWizard";

export default createCommand()
  .setName("sportsub")
  .setDescription("Subscribe to sports leagues and choose how their matches are announced")
  .setPrefix("sportsub")
  .use(guildOnly)
  .use(requirePermission(PermissionFlagsBits.ManageGuild))
  .onComponent("sportsub", handleSportsubComponent)
  .execute(async ({ bot, guildId, respond, t }) => {
    if (!guildId) throw new CommandError(t("errors.guildOnly"));
    if (!bot.events) throw new CommandError(t("errors.dbRequired"));

    const cfg = await bot.guildConfig.get(guildId);
    await respond(sportStep(t, cfg.sportsSubscriptions ?? [], cfg.sportsSubscriptionModes ?? {}));
  })
  .build();
