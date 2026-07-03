import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  MessageFlags,
  StringSelectMenuBuilder,
} from "discord.js";
import { createCommand } from "@/core/commandBuilder";
import { embed } from "@/lib/embeds";
import { CommandError } from "@/lib/errors";
import { guildOnly } from "@/middlewares/guildOnly";

const LIST_LIMIT = 20;

export default createCommand()
  .setName("events")
  .setDescription("List upcoming events and follow them to get pinged")
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
  // Follow toggles from the list's select menu ("event:pick") and from the
  // reminder card's 🔔 button ("event:follow:<id>"). Both are per-user opt-ins
  // to be @mentioned when the event's reminder/start announcements fire.
  .onComponent("event", async ({ bot, interaction, args, guildId, userId, t }) => {
    if (!bot.events || !guildId) return;

    const eventId =
      args[0] === "follow"
        ? args[1]
        : interaction.isStringSelectMenu()
          ? interaction.values[0]
          : undefined;
    // guild_events.id is a bigint — reject junk before it becomes a DB cast error.
    if (!eventId || !/^\d+$/.test(eventId)) return;

    const ev = await bot.events.getUpcoming(eventId, guildId);
    if (!ev) {
      await interaction.reply({ content: t("events.followGone"), flags: MessageFlags.Ephemeral });
      return;
    }

    const following = await bot.events.toggleFollow(ev.id, userId);
    await interaction.reply({
      content: following
        ? t("events.followed", { name: ev.name })
        : t("events.unfollowed", { name: ev.name }),
      flags: MessageFlags.Ephemeral,
    });
  })
  .execute(async ({ bot, args, guildId, reply, t }) => {
    if (!guildId) throw new CommandError(t("errors.guildOnly"));
    if (!bot.events) throw new CommandError(t("errors.dbRequired"));

    const scope = args.scope ?? "week";
    const upcoming =
      scope === "all"
        ? await bot.events.listUpcoming(guildId, LIST_LIMIT)
        : await bot.events.listThisWeek(guildId, LIST_LIMIT);

    if (upcoming.length === 0) {
      const base = scope === "all" ? t("events.listEmpty") : t("events.listEmptyWeek");
      const subs = (await bot.guildConfig.get(guildId)).sportsSubscriptions ?? [];
      const hint = subs.length === 0 ? t("events.listEmptyHint") : "";
      await reply(base + hint);
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

    const follow = new StringSelectMenuBuilder()
      .setCustomId("event:pick")
      .setPlaceholder(t("events.followPrompt"))
      .addOptions(
        upcoming.map((ev) => ({
          label: ev.name.slice(0, 100),
          value: ev.id,
          // Select options can't render Discord timestamps — show UTC.
          description: `${ev.startAt.toISOString().slice(0, 16).replace("T", " ")} UTC`,
        })),
      );

    await reply({
      embeds: [card],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(follow)],
    });
  })
  .build();
