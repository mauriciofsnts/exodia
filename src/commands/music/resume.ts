import { createCommand } from "@/core/commandBuilder.js";
import { CommandError } from "@/lib/errors.js";

export default createCommand()
  .setName("resume")
  .setDescription("Resume paused playback")
  .setPrefix("resume")
  .execute(async ({ bot, reply, guildId, t }) => {
    if (!guildId) throw new CommandError(t("errors.guildOnly"));

    bot.player.resume(guildId);
    await reply(t("music.resumed"));
  })
  .build();
