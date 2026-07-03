import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import type { TFunction } from "@/i18n/index";
import { EmbedColor, embed } from "@/lib/embeds";
import type { GuildEvent } from "./eventRepository";

// Rich announcement card for an event. Manual events (details = null) render a
// plain title + body; auto-imported fixtures add the competition header (league
// badge), both team badges (home = thumbnail, away = footer icon), venue and —
// when known — where to watch.
export function renderEventCard(
  ev: GuildEvent,
  t: TFunction,
  opts: { title: string; body: string; watchOn?: string[] },
) {
  const card = embed(ev.source ? EmbedColor.sports : EmbedColor.primary)
    .setTitle(opts.title)
    .setDescription(opts.body);

  const d = ev.details;
  if (!d) return card;

  if (d.competition) card.setAuthor({ name: d.competition, iconURL: d.leagueBadge });
  if (d.homeBadge) card.setThumbnail(d.homeBadge);
  if (d.away && d.awayBadge) card.setFooter({ text: d.away, iconURL: d.awayBadge });
  if (d.venue) card.addFields({ name: t("events.venueField"), value: d.venue, inline: true });
  if (opts.watchOn?.length) {
    card.addFields({
      name: t("events.watchField"),
      value: opts.watchOn.join(", "),
      inline: true,
    });
  }
  if (d.thumb) card.setImage(d.thumb);

  return card;
}

// 🔔 follow toggle button — customId routed to the "event" component handler
// registered by the /events command.
export function followButtonRow(
  eventId: string,
  t: TFunction,
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`event:follow:${eventId}`)
      .setEmoji("🔔")
      .setLabel(t("events.followButton"))
      .setStyle(ButtonStyle.Secondary),
  );
}
