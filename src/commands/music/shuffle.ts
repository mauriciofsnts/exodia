import { createCommand } from "@/core/commandBuilder";
import { CommandError } from "@/lib/errors";

export default createCommand()
  .setName("shuffle")
  .setDescription("Shuffle the queue")
  .setPrefix("shuffle")
  .execute(async ({ bot, reply, guildId, t }) => {
    if (!guildId) throw new CommandError(t("errors.guildOnly"));

    bot.player.shuffle(guildId);
    await reply(t("music.shuffled"));
  })
  .build();
