import { createCommand } from "@/core/commandBuilder";
import { CommandError } from "@/lib/errors";

export default createCommand()
  .setName("skip")
  .setDescription("Skip the current song")
  .setPrefix("skip")
  .execute(async ({ bot, reply, guildId, t }) => {
    if (!guildId) throw new CommandError(t("errors.guildOnly"));

    bot.player.skip(guildId);
    await reply(t("music.skipped"));
  })
  .build();
