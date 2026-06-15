import { createCommand } from "@/core/commandBuilder.js";
import { CommandError } from "@/lib/errors.js";

export default createCommand()
  .setName("queue")
  .setDescription("Show the music queue")
  .setPrefix("queue")
  .execute(async ({ bot, reply, guildId, t }) => {
    if (!guildId) throw new CommandError(t("errors.guildOnly"));

    const current = bot.player.getCurrent(guildId);
    const queue = bot.player.getQueue(guildId);

    if (!current) {
      await reply(t("music.nothingPlaying"));
      return;
    }

    const lines = [
      t("music.nowPlaying", { title: current.title, requestedBy: current.requestedBy }),
    ];

    if (queue && !queue.isEmpty) {
      queue.list.forEach((track, i) => {
        lines.push(
          t("music.queueEntry", {
            position: i + 1,
            title: track.title,
            requestedBy: track.requestedBy,
          }),
        );
      });
    } else {
      lines.push(t("music.emptyQueue"));
    }

    await reply(lines.join("\n"));
  })
  .build();
