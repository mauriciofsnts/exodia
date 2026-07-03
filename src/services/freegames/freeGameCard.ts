import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import type { TFunction } from "@/i18n/index";
import { EmbedColor, embed } from "@/lib/embeds";
import type { FreeGame, FreeGameStore } from "./types";

const LIST_MAX = 15;
const DESCRIPTION_MAX = 300;

export function storeLabel(t: TFunction, store: FreeGameStore): string {
  return t(`commands.freegames.store.${store}` as Parameters<TFunction>[0]);
}

function endsTag(t: TFunction, endsAt: Date): string {
  return t("commands.freegames.endsTag", {
    when: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`,
  });
}

function excerpt(text: string): string {
  return text.length > DESCRIPTION_MAX ? `${text.slice(0, DESCRIPTION_MAX - 1)}…` : text;
}

// Notification card posted by the scheduler when a new freebie appears:
// clickable title, cover image, short description, where to claim, the old
// price struck through, and the claim deadline (absolute + relative).
export function renderFreeGameCard(game: FreeGame, t: TFunction) {
  const card = embed(EmbedColor.freegames)
    .setAuthor({ name: t("commands.freegames.newTitle") })
    .setTitle(game.title)
    .setURL(game.url)
    .setFooter({ text: t("commands.freegames.cardFooter") })
    .setTimestamp();

  if (game.description) card.setDescription(excerpt(game.description));
  if (game.imageUrl) card.setImage(game.imageUrl);

  card.addFields(
    {
      name: t("commands.freegames.whereField"),
      value: `[${storeLabel(t, game.store)}](${game.url})`,
      inline: true,
    },
    {
      name: t("commands.freegames.priceField"),
      value: game.originalPrice
        ? `~~${game.originalPrice}~~ → ${t("commands.freegames.freeTag")}`
        : t("commands.freegames.freeTag"),
      inline: true,
    },
  );

  if (game.endsAt) {
    const epoch = Math.floor(game.endsAt.getTime() / 1000);
    card.addFields({
      name: t("commands.freegames.endsField"),
      value: `<t:${epoch}:F>\n(<t:${epoch}:R>)`,
      inline: true,
    });
  }

  return card;
}

// Link button straight to the store page, sent alongside the notification card.
export function claimButtonRow(
  game: FreeGame,
  t: TFunction,
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel(t("commands.freegames.claimButton"))
      .setURL(game.url),
  );
}

// On-demand listing for /freegames: one line per game, grouped by store.
export function renderFreeGamesList(games: FreeGame[], t: TFunction) {
  const byStore = [...games].sort(
    (a, b) => a.store.localeCompare(b.store) || a.title.localeCompare(b.title),
  );

  const lines = byStore.slice(0, LIST_MAX).map((game) => {
    const title = game.title.replace(/[[\]]/g, "");
    const base = t("commands.freegames.listEntry", {
      title,
      url: game.url,
      store: storeLabel(t, game.store),
    });
    return game.endsAt ? `${base} · ${endsTag(t, game.endsAt)}` : base;
  });
  if (byStore.length > LIST_MAX) {
    lines.push(t("commands.freegames.listMore", { count: byStore.length - LIST_MAX }));
  }

  return embed(EmbedColor.freegames)
    .setTitle(t("commands.freegames.listTitle"))
    .setDescription(lines.join("\n"))
    .setFooter({ text: t("commands.freegames.listFooter", { count: games.length }) })
    .setTimestamp();
}
