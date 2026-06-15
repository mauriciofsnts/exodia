import { createCommand } from "@/core/commandBuilder.js";
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

    const lines = [t("events.listHeader")];
    for (const ev of upcoming) {
      const when = `<t:${Math.floor(ev.startAt.getTime() / 1000)}:R>`;
      lines.push(t("events.listEntry", { name: ev.name, when }));
    }
    await reply(lines.join("\n"));
  })
  .build();
