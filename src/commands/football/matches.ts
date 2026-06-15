import { ApplicationCommandOptionType, EmbedBuilder } from "discord.js";
import { createCommand } from "@/core/commandBuilder.js";
import { CommandError } from "@/lib/errors.js";
import { cached } from "@/services/cache/cached.js";
import { LEAGUES } from "@/services/football/leagues.js";
import { TheSportsDbProvider } from "@/services/football/theSportsDbProvider.js";

const LIMIT = 8;
const CACHE_TTL = 300; // 5 minutes
const EMBED_COLOR = 0x2ecc71;

export default createCommand()
  .setName("matches")
  .setDescription("Upcoming football matches by championship")
  .setPrefix("matches")
  .addOption({
    name: "championship",
    description: "Championship",
    type: ApplicationCommandOptionType.String,
    required: true,
    choices: Object.entries(LEAGUES).map(([key, league]) => ({ name: league.label, value: key })),
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

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle(title)
      .setDescription(lines.join("\n"));

    await reply({ embeds: [embed] });
  })
  .build();
