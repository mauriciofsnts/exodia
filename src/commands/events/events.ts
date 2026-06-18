import { createCommand } from "@/core/commandBuilder.js";
import { embed } from "@/lib/embeds.js";
import { CommandError } from "@/lib/errors.js";
import { guildOnly } from "@/middlewares/guildOnly.js";

export default createCommand()
  .setName("events")
  .setDescription("List upcoming events")
  .setPrefix("events")
  .use(guildOnly)
  .execute(async ({ bot, guildId, reply, t }) => {
    if (!guildId) throw new CommandError(t("errors.guildOnly"));
    if (!bot.events) throw new CommandError(t("errors.dbRequired"));

    const upcoming = await bot.events.listUpcoming(guildId, 10);
    if (upcoming.length === 0) {
      await reply(t("events.listEmpty"));
      return;
    }

    const lines = upcoming.map((ev) => {
      const when = `<t:${Math.floor(ev.startAt.getTime() / 1000)}:R>`;
      return t("events.listEntry", { name: ev.name, when });
    });

    const card = embed()
      .setTitle(t("events.listTitle"))
      .setDescription(lines.join("\n"))
      .setFooter({ text: t("events.listFooter", { count: upcoming.length }) });

    await reply({ embeds: [card] });
  })
  .build();
