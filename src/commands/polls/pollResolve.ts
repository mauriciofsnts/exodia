import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { createCommand } from "@/core/commandBuilder";
import { embed } from "@/lib/embeds";
import { CommandError } from "@/lib/errors";
import { guildOnly } from "@/middlewares/guildOnly";
import { requirePermission } from "@/middlewares/requirePermission";
import { optionEmoji, renderResolved } from "@/services/polls/pollCard";
import type { Poll } from "@/services/polls/pollRepository";

export default createCommand()
  .setName("pollresolve")
  .setDescription("Resolve a poll and pay out the pot to the winners (admin)")
  .setPrefix("pollresolve")
  .addOption({
    name: "id",
    description: "Poll ID to resolve",
    type: ApplicationCommandOptionType.Integer,
    required: true,
  })
  .addOption({
    name: "option",
    description: "Winning option number (1, 2, 3, …)",
    type: ApplicationCommandOptionType.Integer,
    required: true,
  })
  .use(guildOnly)
  .use(requirePermission(PermissionFlagsBits.ManageGuild))
  .execute(async ({ bot, args, guildId, reply, t }) => {
    if (!guildId) throw new CommandError(t("errors.guildOnly"));
    if (!bot.polls) throw new CommandError(t("errors.dbRequired"));

    // Options are shown 1-based to users; store 0-based.
    const outcome = await bot.polls.resolve(guildId, args.id, args.option - 1);

    if (outcome.status === "not_found") throw new CommandError(t("polls.resolveNotFound"));
    if (outcome.status === "already_resolved")
      throw new CommandError(t("polls.resolveAlreadyResolved"));
    if (outcome.status === "invalid_option")
      throw new CommandError(t("polls.resolveInvalidOption"));

    const poll = outcome.poll as Poll;
    const winnerLabel = poll.options[poll.winningOption ?? 0];
    const winnerEmoji = optionEmoji(poll.winningOption ?? 0);

    // Refresh the original poll message in place (best-effort).
    if (poll.channelId && poll.messageId) {
      try {
        const channel = await bot.client.channels.fetch(poll.channelId);
        if (channel?.isTextBased() && !channel.isDMBased()) {
          const message = await channel.messages.fetch(poll.messageId);
          const tally = await bot.polls.tally(poll.id);
          await message.edit(renderResolved(poll, tally, t));
        }
      } catch (err) {
        bot.logger.warn({ err, pollId: poll.id }, "Failed to update resolved poll message");
      }
    }

    const summary =
      outcome.pot && outcome.pot > 0
        ? outcome.refunded
          ? t("polls.resolvedRefunded", { pot: outcome.pot })
          : t("polls.resolvedPayout", { pot: outcome.pot, winners: outcome.winnerCount ?? 0 })
        : t("polls.resolvedNoStake");

    const card = embed()
      .setTitle(t("polls.resolvedReplyTitle"))
      .setDescription(
        t("polls.resolvedReplyBody", {
          question: poll.question,
          emoji: winnerEmoji,
          option: winnerLabel,
        }),
      )
      .setFooter({ text: summary });

    await reply({ embeds: [card] });
  })
  .build();
