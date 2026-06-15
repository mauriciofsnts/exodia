import { createCommand } from "@/core/commandBuilder.js";
import { CommandError } from "@/lib/errors.js";

export default createCommand()
  .setName("stop")
  .setDescription("Stop music and clear the queue")
  .setPrefix("stop")
  .execute(async ({ bot, reply, guildId, t }) => {
    if (!guildId) throw new CommandError(t("errors.guildOnly"));

    bot.player.stop(guildId);
    await reply(t("music.stopped"));
  })
  .build();
