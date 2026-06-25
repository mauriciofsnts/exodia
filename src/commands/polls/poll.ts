import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { createCommand } from "@/core/commandBuilder";
import { CommandError } from "@/lib/errors";
import { guildOnly } from "@/middlewares/guildOnly";
import { MAX_POLL_OPTIONS, renderPoll } from "@/services/polls/pollCard";

// Options are separated by "|" so a single option can contain commas.
function parseOptions(input: string): string[] {
  return input
    .split("|")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

export default createCommand()
  .setName("poll")
  .setDescription("Create a poll — add a stake to let members bet on the outcome")
  .setPrefix("poll")
  .addOption({
    name: "question",
    description: "What the poll asks",
    type: ApplicationCommandOptionType.String,
    required: true,
  })
  .addOption({
    name: "options",
    description: 'Options separated by "|", e.g. Red | Blue | Green',
    type: ApplicationCommandOptionType.String,
    required: true,
  })
  .addOption({
    name: "stake",
    description: "Coins each vote costs (0 = plain poll). Winners split the pot.",
    type: ApplicationCommandOptionType.Integer,
    required: false,
  })
  .addOption({
    name: "minutes",
    description: "Minutes until voting closes (default: stays open until resolved)",
    type: ApplicationCommandOptionType.Integer,
    required: false,
  })
  .use(guildOnly)
  .onComponent("poll", async (ctx) => {
    const { bot, interaction, args, userId, guildId, t } = ctx;
    const [action, pollIdRaw, choiceRaw] = args;
    if (action !== "vote" || !guildId || !bot.polls) return;

    const poll = await bot.polls.get(Number(pollIdRaw));
    if (!poll || poll.guildId !== guildId) {
      await interaction.reply({ content: t("polls.voteClosed"), flags: MessageFlags.Ephemeral });
      return;
    }

    const result = await bot.polls.castVote(poll, userId, Number(choiceRaw));
    if (result === "already_voted") {
      await interaction.reply({ content: t("polls.alreadyVoted"), flags: MessageFlags.Ephemeral });
      return;
    }
    if (result === "insufficient") {
      await interaction.reply({
        content: t("polls.insufficient", { stake: poll.stake }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (result === "closed") {
      await interaction.reply({ content: t("polls.voteClosed"), flags: MessageFlags.Ephemeral });
      return;
    }

    // Vote recorded — refresh the message in place with the new tally.
    const tally = await bot.polls.tally(poll.id);
    await interaction.update(renderPoll(poll, tally, t));
  })
  .execute(async ({ bot, args, guildId, channelId, userId, respond, t }) => {
    if (!guildId) throw new CommandError(t("errors.guildOnly"));
    if (!bot.polls) throw new CommandError(t("errors.dbRequired"));

    const options = parseOptions(args.options);
    if (options.length < 2 || options.length > MAX_POLL_OPTIONS)
      throw new CommandError(t("polls.invalidOptions", { max: MAX_POLL_OPTIONS }));

    const stake = args.stake ?? 0;
    if (stake < 0) throw new CommandError(t("economy.invalidAmount"));

    const minutes = args.minutes ?? 0;
    if (minutes < 0) throw new CommandError(t("polls.invalidMinutes"));
    const closesAt = minutes > 0 ? new Date(Date.now() + minutes * 60_000) : null;

    const id = await bot.polls.create({
      guildId,
      channelId,
      question: args.question,
      options,
      stake,
      closesAt,
      createdBy: userId,
    });

    const poll = {
      id,
      guildId,
      channelId,
      messageId: null,
      question: args.question,
      options,
      stake,
      closesAt,
      status: "open" as const,
      winningOption: null,
      createdBy: userId,
    };
    const tally = { counts: new Array<number>(options.length).fill(0), pot: 0, voters: 0 };

    // For prefix invocations `reply` posts the card directly; for slash, respond()
    // edits/sends the (possibly deferred) reply and hands back the Message so we
    // can record its id for later resolution.
    const message = await respond(renderPoll(poll, tally, t));
    await bot.polls.attachMessage(id, channelId, message.id);
  })
  .build();
