import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type Message } from "discord.js";
import type { BotContext } from "@/core/context";
import type { TFunction } from "@/i18n/index";
import { EmbedColor, embed } from "@/lib/embeds";
import { VOTE_EMOJIS } from "@/services/music/voteRepository";
import type { Track } from "./track";
import { youtubeThumbnail } from "./youtubeSearch";

const NEXT_PREVIEW = 3; // upcoming tracks shown before the "+N more" line

// seconds → "m:ss" (or "h:mm:ss" past an hour).
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

// Preview of the pending queue: the next few titles, then "+N more" so it's
// clear there's a tail without dumping the whole queue.
function upcomingField(upcoming: readonly Track[], t: TFunction): string {
  const lines = upcoming
    .slice(0, NEXT_PREVIEW)
    .map(
      (tr, i) => `\`${i + 1}.\` ${tr.title.length > 70 ? `${tr.title.slice(0, 69)}…` : tr.title}`,
    );

  const extra = upcoming.length - NEXT_PREVIEW;
  if (extra > 0) lines.push(t("music.queueMore", { count: extra }));
  return lines.join("\n");
}

// The play card: rich embed (thumbnail + duration + queue preview) plus playback
// controls. `headline` overrides the description line (defaults to "added to
// queue"); /nowplaying passes a "now playing" headline instead.
export function playCard(
  track: Track,
  displayName: string,
  upcoming: readonly Track[],
  t: TFunction,
  headline?: string,
) {
  const card = embed(EmbedColor.music)
    .setTitle(track.title)
    .setURL(track.url)
    .setDescription(headline ?? t("music.addedToQueue", { title: track.title }))
    .setFooter({ text: `${displayName} · ${t("music.voteHint")}` });

  const thumb = youtubeThumbnail(track.url);
  if (thumb) card.setThumbnail(thumb);
  if (track.duration > 0) {
    card.addFields({
      name: t("music.durationField"),
      value: formatDuration(track.duration),
      inline: true,
    });
  }
  if (upcoming.length > 0) {
    card.addFields({ name: t("music.queueUpNext"), value: upcomingField(upcoming, t) });
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("music:pause").setEmoji("⏯️").setStyle(ButtonStyle.Secondary),
  );
  // Skip only makes sense when there's a next track queued behind the current one.
  if (upcoming.length > 0) {
    row.addComponents(
      new ButtonBuilder().setCustomId("music:skip").setEmoji("⏭️").setStyle(ButtonStyle.Secondary),
    );
  }
  row.addComponents(
    new ButtonBuilder().setCustomId("music:shuffle").setEmoji("🔀").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music:stop").setEmoji("⏹️").setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [card], components: [row] };
}

// Marks a card message as votable and seeds the vote reactions (no-op without
// persistence — nothing would record them).
export async function seedVotes(
  bot: BotContext,
  message: Message,
  guildId: string,
  url: string,
): Promise<void> {
  if (!bot.votes) return;
  await bot.votes.registerMessage(message.id, guildId, url);
  for (const emoji of Object.keys(VOTE_EMOJIS)) {
    await message.react(emoji).catch(() => {});
  }
}
