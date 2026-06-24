import { ApplicationCommandOptionType } from "discord.js";
import { createCommand } from "@/core/commandBuilder";
import { EmbedColor, embed } from "@/lib/embeds";
import { CommandError } from "@/lib/errors";
import { cached } from "@/infra/cache/cached";
import { LEAGUES } from "@/services/sports/leagues/football";
import { TheSportsDbProvider } from "@/services/sports/provider/theSportsDbProvider";

const LIMIT = 8;
const CACHE_TTL = 300; // 5 minutes

export default createCommand()
  .setName("matches")
  .setDescription("Upcoming football matches by championship")
  .setPrefix("matches")
  .addOption({
    name: "championship",
    description: "Championship",
    type: ApplicationCommandOptionType.String,
    required: true,
    autocomplete: ({ value }) => {
      const q = value.trim().toLowerCase();
      return Object.entries(LEAGUES)
        .filter(([key, league]) => !q || key.includes(q) || league.label.toLowerCase().includes(q))
        .slice(0, 25)
        .map(([key, league]) => ({ name: league.label, value: key }));
    },
  })
  .execute(async ({ bot, args, reply, defer, t }) => {
    const league = LEAGUES[args.championship.toLowerCase()];
    if (!league) throw new CommandError(t("commands.matches.unknown"));

    await defer();

    const { kind, matches } = await cached(bot.cache, `cache:matches:${league.id}`, CACHE_TTL, () =>
      new TheSportsDbProvider(bot.config.SPORTSDB_API_KEY).matches(league.id, LIMIT),
    ).catch(() => {
      throw new CommandError(t("commands.matches.failed"));
    });

    if (matches.length === 0) {
      await reply(t("commands.matches.empty", { league: league.label }));
      return;
    }

    const lines = matches.map((match) => {
      const middle = match.score ? `**${match.score}**` : "vs";
      return `• ${match.home} ${middle} ${match.away} — ${match.startsAt}`;
    });

    const title =
      kind === "upcoming"
        ? t("commands.matches.headerUpcoming", { league: league.label })
        : t("commands.matches.headerRecent", { league: league.label });

    const card = embed(EmbedColor.sports)
      .setTitle(title)
      .setDescription(lines.join("\n"))
      .setFooter({ text: t("commands.matches.footer", { count: matches.length }) })
      .setTimestamp();

    await reply({ embeds: [card] });
  })
  .build();
