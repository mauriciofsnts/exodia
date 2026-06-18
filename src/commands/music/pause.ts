import { createCommand } from "@/core/commandBuilder.js";
import { CommandError } from "@/lib/errors.js";

export default createCommand()
  .setName("pause")
  .setDescription("Pause or resume playback")
  .setPrefix("pause")
  .execute(async ({ bot, reply, guildId, t }) => {
    if (!guildId) throw new CommandError(t("errors.guildOnly"));

    // Toggle: a second !pause resumes, so one command covers both.
    const paused = bot.player.togglePause(guildId);
    await reply(paused ? t("music.paused") : t("music.resumed"));
  })
  .build();
