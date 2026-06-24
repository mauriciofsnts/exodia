import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { type ComponentExecutionContext, createCommand } from "@/core/commandBuilder";
import type { BotContext } from "@/core/context";
import type { TFunction } from "@/i18n/index";
import { embed } from "@/lib/embeds";
import { CommandError } from "@/lib/errors";
import { cached } from "@/services/cache/cached";
import { NEWS_CATEGORIES, newsProviders } from "@/services/news/index";
import type { NewsItem } from "@/services/news/types";

const PER_PAGE = 5;
// Headlines fetched (and cached) per category. Pagination walks this pool from
// the cache, so navigating pages never re-hits the upstream provider.
const POOL = 30;
const CACHE_TTL = 300; // 5 minutes
const COMPONENT_PREFIX = "news";

// Load the cached headline pool for a category. The data is cached once per
// category (keyed below) so button navigation reads straight from Redis; only a
// cache miss / expiry refetches from the provider.
function loadHeadlines(bot: BotContext, category: string, t: TFunction): Promise<NewsItem[]> {
  const provider = newsProviders.get(category);
  if (!provider) throw new CommandError(t("commands.news.unknown"));

  return cached(bot.cache, `cache:news:${category}`, CACHE_TTL, () =>
    provider.fetchHeadlines(POOL),
  ).catch(() => {
    throw new CommandError(t("commands.news.failed"));
  });
}

// Renders one page of headlines plus prev/next navigation buttons. The target
// page is clamped, so out-of-range input (e.g. a stale button) lands on a valid
// page instead of an empty embed. The page number is carried entirely in the
// button customId — no per-message state is kept server-side.
function renderPage(t: TFunction, category: string, items: NewsItem[], page: number) {
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const current = Math.min(Math.max(page, 0), pages - 1);
  const start = current * PER_PAGE;

  const lines = items.slice(start, start + PER_PAGE).map((item) => {
    const title = item.title.replace(/[[\]]/g, "");
    return `• [${title}](${item.url})${item.source ? ` — ${item.source}` : ""}`;
  });

  const card = embed()
    .setTitle(t("commands.news.header", { category }))
    .setDescription(lines.join("\n"))
    .setFooter({
      text: t("commands.news.pageFooter", { page: current + 1, pages, count: items.length }),
    })
    .setTimestamp();

  // Single page → no need for navigation controls.
  if (pages <= 1) return { embeds: [card], components: [] };

  const prev = new ButtonBuilder()
    .setCustomId(`${COMPONENT_PREFIX}:${category}:${current - 1}`)
    .setEmoji("◀️")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(current === 0);
  const next = new ButtonBuilder()
    .setCustomId(`${COMPONENT_PREFIX}:${category}:${current + 1}`)
    .setEmoji("▶️")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(current === pages - 1);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(prev, next);
  return { embeds: [card], components: [row] };
}

// Routes "news:<category>:<page>" button clicks. Reads the cached pool and edits
// the same message in place to the requested page.
async function handleNewsPage(ctx: ComponentExecutionContext): Promise<void> {
  const [category, pageRaw] = ctx.args;
  const page = Number.parseInt(pageRaw, 10) || 0;

  const items = await loadHeadlines(ctx.bot, category, ctx.t);
  if (items.length === 0) {
    await ctx.interaction.update({
      content: ctx.t("commands.news.empty"),
      embeds: [],
      components: [],
    });
    return;
  }

  await ctx.interaction.update(renderPage(ctx.t, category, items, page));
}

export default createCommand()
  .setName("news")
  .setDescription("Latest headlines by category (dev, tabnews, world, football, sports)")
  .setPrefix("news")
  .addOption({
    name: "category",
    description: "News category",
    type: ApplicationCommandOptionType.String,
    required: true,
    choices: NEWS_CATEGORIES.map((category) => ({ name: category, value: category })),
  })
  .onComponent(COMPONENT_PREFIX, handleNewsPage)
  .execute(async ({ bot, args, reply, defer, t }) => {
    const category = args.category.toLowerCase();

    await defer();

    const items = await loadHeadlines(bot, category, t);
    if (items.length === 0) {
      await reply(t("commands.news.empty"));
      return;
    }

    await reply(renderPage(t, category, items, 0));
  })
  .build();
