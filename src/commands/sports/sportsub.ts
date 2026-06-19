import { PermissionFlagsBits } from "discord.js";
import { createCommand } from "@/core/commandBuilder.js";
import { CommandError } from "@/lib/errors.js";
import { guildOnly } from "@/middlewares/guildOnly.js";
import { requirePermission } from "@/middlewares/requirePermission.js";
import { handleSportsubComponent, sportStep } from "@/services/sports/sportsubWizard.js";

export default createCommand()
  .setName("sportsub")
  .setDescription("Subscribe this server to auto-import sports fixtures as events")
  .setPrefix("sportsub")
  .use(guildOnly)
  .use(requirePermission(PermissionFlagsBits.ManageGuild))
  .onComponent("sportsub", handleSportsubComponent)
  .execute(async ({ bot, guildId, respond, t }) => {
    if (!guildId) throw new CommandError(t("errors.guildOnly"));
    if (!bot.events) throw new CommandError(t("errors.dbRequired"));

    const subs = (await bot.guildConfig.get(guildId)).sportsSubscriptions ?? [];
    await respond(sportStep(t, subs));
  })
  .build();
