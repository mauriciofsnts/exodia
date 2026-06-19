import { PermissionFlagsBits } from "discord.js";
import { createCommand } from "@/core/commandBuilder";
import { CommandError } from "@/lib/errors";
import { guildOnly } from "@/middlewares/guildOnly";
import { requirePermission } from "@/middlewares/requirePermission";
import { doneStep, handleOnboardComponent, languageStep } from "@/services/guild/onboardingWizard";

export default createCommand()
  .setName("setup")
  .setDescription("View or change this server's configuration")
  .setPrefix("setup")
  .use(guildOnly)
  .use(requirePermission(PermissionFlagsBits.ManageGuild))
  .onComponent("onboard", handleOnboardComponent)
  .execute(async ({ bot, guildId, respond, t }) => {
    if (!guildId) throw new CommandError(t("errors.guildOnly"));

    const cfg = await bot.guildConfig.get(guildId);
    // Already set up: open straight on the summary (with a "restart" button)
    // instead of forcing the wizard from step one every time.
    await respond(cfg.configured ? doneStep(t, cfg) : languageStep(t));
  })
  .build();
