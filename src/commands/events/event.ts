import { ApplicationCommandOptionType } from "discord.js";
import { createCommand } from "@/core/commandBuilder";
import { CommandError } from "@/lib/errors";
import { guildOnly } from "@/middlewares/guildOnly";
import { followButtonRow, renderEventCard } from "@/services/events/eventCard";

export default createCommand()
  .setName("event")
  .setDescription("Show details for an upcoming event")
  .setPrefix("event")
  .addOption({
    name: "event",
    description: "Event to look up",
    type: ApplicationCommandOptionType.String,
    required: true,
    autocomplete: async ({ bot, value, guildId }) => {
      if (!bot.events || !guildId) return [];
      const upcoming = await bot.events.searchUpcoming(guildId, value.trim(), 25);
      return upcoming.map((ev) => ({
        // Autocomplete can't render Discord timestamps — show UTC. Choice names
        // cap at 100 chars.
        name: `${ev.name} — ${ev.startAt.toISOString().slice(0, 16).replace("T", " ")} UTC`.slice(
          0,
          100,
        ),
        value: ev.id,
      }));
    },
  })
  .use(guildOnly)
  .execute(async ({ bot, args, guildId, reply, defer, t }) => {
    if (!guildId) throw new CommandError(t("errors.guildOnly"));
    if (!bot.events) throw new CommandError(t("errors.dbRequired"));

    // The where-to-watch lookup may hit the provider — buy time.
    await defer();

    // Autocomplete submits the event id; free-typed text (and prefix usage)
    // falls back to a name search.
    const query = args.event.trim();
    let ev = /^\d+$/.test(query) ? await bot.events.getUpcoming(query, guildId) : null;
    ev ??= (await bot.events.searchUpcoming(guildId, query, 1))[0] ?? null;
    if (!ev) throw new CommandError(t("events.notFound"));

    const watchOn =
      ev.externalId && bot.sportsImporter
        ? await bot.sportsImporter.whereToWatch(ev.source, ev.externalId)
        : [];

    const start = Math.floor(ev.startAt.getTime() / 1000);
    const card = renderEventCard(ev, t, {
      title: ev.name,
      body: t("events.detailWhen", { when: `<t:${start}:F> (<t:${start}:R>)` }),
      watchOn,
    });

    const followers = await bot.events.followers(ev.id);
    card.addFields({
      name: t("events.followersField"),
      value: String(followers.length),
      inline: true,
    });

    await reply({ embeds: [card], components: [followButtonRow(ev.id, t)] });
  })
  .build();
