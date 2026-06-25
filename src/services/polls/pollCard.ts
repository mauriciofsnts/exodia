import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import type { TFunction } from "@/i18n/index";
import { EmbedColor, embed } from "@/lib/embeds";
import type { Poll, PollTally } from "./pollRepository";

// Up to 10 options — keeps the buttons within two action rows (5 per row) and
// gives every option a recognisable number emoji.
export const MAX_POLL_OPTIONS = 10;
const NUMBER_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

export function optionEmoji(index: number): string {
  return NUMBER_EMOJIS[index] ?? `#${index + 1}`;
}

function buttonRows(poll: Poll): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const buttons = poll.options.map((_, i) =>
    new ButtonBuilder()
      .setCustomId(`poll:vote:${poll.id}:${i}`)
      .setEmoji(optionEmoji(i))
      .setStyle(ButtonStyle.Secondary),
  );
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        buttons.slice(i, i + 5),
      ),
    );
  }
  return rows;
}

// The live poll message: question, each option with its current vote count, and a
// footer noting the stake and (if any) the voting deadline. Buttons let members vote.
export function renderPoll(poll: Poll, tally: PollTally, t: TFunction) {
  const lines = poll.options.map((label, i) =>
    t("polls.optionLine", { emoji: optionEmoji(i), label, votes: tally.counts[i] ?? 0 }),
  );

  const footer =
    poll.stake > 0
      ? t("polls.footerStaked", { stake: poll.stake, pot: tally.pot, voters: tally.voters })
      : t("polls.footerPlain", { voters: tally.voters });

  const card = embed(EmbedColor.primary)
    .setTitle(t("polls.title", { question: poll.question }))
    .setDescription(lines.join("\n"))
    .setFooter({ text: footer });

  if (poll.closesAt)
    card.addFields({
      name: t("polls.closesField"),
      value: `<t:${Math.floor(poll.closesAt.getTime() / 1000)}:R>`,
    });

  return { embeds: [card], components: buttonRows(poll) };
}

// The poll message after resolution: marks the winning option, drops the buttons.
export function renderResolved(poll: Poll, tally: PollTally, t: TFunction) {
  const winner = poll.winningOption ?? -1;
  const lines = poll.options.map((label, i) => {
    const line = t("polls.optionLine", {
      emoji: optionEmoji(i),
      label,
      votes: tally.counts[i] ?? 0,
    });
    return i === winner ? `**${line} ✅**` : line;
  });

  const card = embed(EmbedColor.success)
    .setTitle(t("polls.resolvedTitle", { question: poll.question }))
    .setDescription(lines.join("\n"))
    .setFooter({
      text:
        poll.stake > 0
          ? t("polls.footerStaked", { stake: poll.stake, pot: tally.pot, voters: tally.voters })
          : t("polls.footerPlain", { voters: tally.voters }),
    });

  return { embeds: [card], components: [] };
}
