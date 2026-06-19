import { ApplicationCommandOptionType } from "discord.js";
import { createCommand } from "@/core/commandBuilder.js";
import { embed } from "@/lib/embeds.js";
import { CommandError } from "@/lib/errors.js";
import { guildOnly } from "@/middlewares/guildOnly.js";

const LIST_LIMIT = 20;

export default createCommand()
  .setName("events")
  .setDescription("List upcoming events")
  .setPrefix("events")
  .addOption({
    name: "scope",
    description: "Which events to show",
    type: ApplicationCommandOptionType.String,
    required: false,
    choices: [
      { name: "this week", value: "week" },
      { name: "all upcoming", value: "all" },
    ],
  })
  .use(guildOnly)
  .execute(async ({ bot, args, guildId, reply, t }) => {
    if (!guildId) throw new CommandError(t("errors.guildOnly"));
    if (!bot.events) throw new CommandError(t("errors.dbRequired"));

    const scope = args.scope ?? "week";
    const upcoming =
      scope === "all"
        ? await bot.events.listUpcoming(guildId, LIST_LIMIT)
        : await bot.events.listThisWeek(guildId, LIST_LIMIT);

    if (upcoming.length === 0) {
      await reply(scope === "all" ? t("events.listEmpty") : t("events.listEmptyWeek"));
      return;
    }

    const lines = upcoming.map((ev) => {
      const when = `<t:${Math.floor(ev.startAt.getTime() / 1000)}:R>`;
      return t("events.listEntry", { name: ev.name, when });
    });

    const card = embed()
      .setTitle(scope === "all" ? t("events.listTitle") : t("events.listTitleWeek"))
      .setDescription(lines.join("\n"))
      .setFooter({ text: t("events.listFooter", { count: upcoming.length }) });

    await reply({ embeds: [card] });
  })
  .build();
