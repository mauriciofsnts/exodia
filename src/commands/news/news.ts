import { ApplicationCommandOptionType } from "discord.js";
import { createCommand } from "@/core/commandBuilder.js";
import { embed } from "@/lib/embeds.js";
import { CommandError } from "@/lib/errors.js";
import { cached } from "@/services/cache/cached.js";
import { NEWS_CATEGORIES, newsProviders } from "@/services/news/index.js";

const LIMIT = 5;
const CACHE_TTL = 300; // 5 minutes

export default createCommand()
  .setName("news")
  .setDescription("Latest headlines by category (dev, world, football, sports)")
  .setPrefix("news")
  .addOption({
    name: "category",
    description: "News category",
    type: ApplicationCommandOptionType.String,
    required: true,
    choices: NEWS_CATEGORIES.map((category) => ({ name: category, value: category })),
  })
  .execute(async ({ bot, args, reply, defer, t }) => {
    const category = args.category.toLowerCase();
    const provider = newsProviders.get(category);
    if (!provider) throw new CommandError(t("commands.news.unknown"));

    await defer();

    const items = await cached(bot.cache, `cache:news:${category}`, CACHE_TTL, () =>
      provider.fetchHeadlines(LIMIT),
    ).catch(() => {
      throw new CommandError(t("commands.news.failed"));
    });

    if (items.length === 0) {
      await reply(t("commands.news.empty"));
      return;
    }

    const lines = items.map((item) => {
      const title = item.title.replace(/[[\]]/g, "");
      return `• [${title}](${item.url})${item.source ? ` — ${item.source}` : ""}`;
    });

    const card = embed()
      .setTitle(t("commands.news.header", { category: args.category }))
      .setDescription(lines.join("\n"))
      .setFooter({ text: t("commands.news.footer", { count: items.length }) })
      .setTimestamp();

    await reply({ embeds: [card] });
  })
  .build();
