import { createCommand } from "@/core/commandBuilder";
import { EmbedColor, embed } from "@/lib/embeds";
import { CommandError } from "@/lib/errors";

export default createCommand()
  .setName("queue")
  .setDescription("Show the music queue")
  .setPrefix("queue")
  .execute(async ({ bot, reply, guildId, t }) => {
    if (!guildId) throw new CommandError(t("errors.guildOnly"));

    const current = bot.player.getCurrent(guildId);
    const queue = bot.player.getQueue(guildId);

    // Nothing playing → a one-liner is enough.
    if (!current) {
      await reply(t("music.nothingPlaying"));
      return;
    }

    const upNext =
      queue && !queue.isEmpty
        ? queue.list
            .map((track, i) =>
              t("music.queueEntry", {
                position: i + 1,
                title: track.title,
                requestedBy: track.requestedBy,
              }),
            )
            .join("\n")
        : t("music.emptyQueue");

    const card = embed(EmbedColor.music)
      .setTitle(t("music.queueTitle"))
      .addFields(
        {
          name: t("music.queueNowPlaying"),
          value: t("music.queueCurrent", {
            title: current.title,
            requestedBy: current.requestedBy,
          }),
        },
        { name: t("music.queueUpNext"), value: upNext },
      );

    if (queue && !queue.isEmpty) {
      card.setFooter({ text: t("music.queueFooter", { count: queue.list.length }) });
    }

    await reply({ embeds: [card] });
  })
  .build();
