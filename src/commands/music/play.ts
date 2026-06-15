import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import { search, type YouTubeVideo } from "play-dl";
import {
  type ComponentExecutionContext,
  createCommand,
  type ReactionExecutionContext,
} from "@/core/commandBuilder.js";
import { CommandError, PlayerError } from "@/lib/errors.js";
import { cooldown } from "@/middlewares/cooldown.js";
import { guildOnly } from "@/middlewares/guildOnly.js";
import { VOTE_EMOJIS } from "@/services/music/voteRepository.js";
import type { Track } from "@/services/player/track.js";

// Records (or clears) a like/dislike/fav vote when someone reacts on a play card.
// Self-filters: ignores non-vote emojis and messages that aren't vote cards.
async function handleVoteReaction(ctx: ReactionExecutionContext): Promise<void> {
  const votes = ctx.bot.votes;
  if (!votes) return;

  const vote = VOTE_EMOJIS[ctx.emoji];
  if (!vote) return;

  const target = await votes.lookupMessage(ctx.reaction.message.id);
  if (!target) return;

  if (ctx.event === "add") {
    await votes.addVote(target.guildId, target.url, ctx.user.id, vote);
  } else {
    await votes.removeVote(target.guildId, target.url, ctx.user.id, vote);
  }
}

// Skip button on the play card (component routed by the "music" customId prefix).
async function handleSkipButton(ctx: ComponentExecutionContext): Promise<void> {
  if (!ctx.guildId) return;
  try {
    ctx.bot.player.skip(ctx.guildId);
    await ctx.interaction.reply({ content: ctx.t("music.skipped"), flags: MessageFlags.Ephemeral });
  } catch (err) {
    const message = err instanceof PlayerError ? err.message : ctx.t("errors.generic");
    await ctx.interaction.reply({ content: `❌ ${message}`, flags: MessageFlags.Ephemeral });
  }
}

export default createCommand()
  .setName("play")
  .setDescription("Play a song from YouTube")
  .setPrefix("play")
  .addOption({
    name: "query",
    description: "Song name or URL",
    type: ApplicationCommandOptionType.String,
    required: true,
  })
  .use(guildOnly)
  .use(cooldown(3))
  .onReaction(handleVoteReaction)
  .onComponent("music", handleSkipButton)
  .execute(async ({ bot, args, respond, defer, voiceChannel, textChannel, displayName, t }) => {
    if (!voiceChannel) throw new CommandError(t("errors.notInVoice"));

    // Search + stream resolution can exceed Discord's 3s window — defer first.
    await defer();

    // voiceChannel guarantees a guild, so its id is the per-guild cache scope.
    const guildId = voiceChannel.guild.id;

    // Resolve the track from the persisted query→track cache before spending a
    // YouTube search; cache misses search YT and then remember the result.
    const cached = await bot.trackCache?.find(guildId, args.query);

    let track: Track;
    if (cached) {
      track = { ...cached, requestedBy: displayName };
    } else {
      const results = await search(args.query, { source: { youtube: "video" }, limit: 1 });
      // play-dl returns a union that collapses to never — cast to the expected type
      const video = results[0] as YouTubeVideo | undefined;

      if (!video?.url) throw new CommandError(t("errors.noResults"));

      track = {
        title: video.title ?? "Unknown",
        url: video.url,
        duration: video.durationInSec ?? 0,
        requestedBy: displayName,
      };
      // Save this query as an alias that resolves to the track next time.
      await bot.trackCache?.save(guildId, args.query, track);
    }

    // Playback events fire detached from this interaction, so announce in the
    // invoking text channel (which stays valid) rather than via reply.
    const announce = (content: string) => {
      if (textChannel?.isSendable()) textChannel.send(content).catch(() => {});
    };

    await bot.player.play(voiceChannel, track, {
      trackStart: (started) =>
        announce(t("music.nowPlaying", { title: started.title, requestedBy: started.requestedBy })),
      trackError: (errored) => announce(t("music.trackError", { title: errored.title })),
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(track.title)
      .setURL(track.url)
      .setDescription(t("music.addedToQueue", { title: track.title }))
      .setFooter({ text: `${displayName} · ${t("music.voteHint")}` });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("music:skip")
        .setEmoji("⏭️")
        .setLabel("Skip")
        .setStyle(ButtonStyle.Secondary),
    );

    const card = await respond({ embeds: [embed], components: [row] });

    // Seed the vote reactions (no-op without persistence — nothing would record them).
    if (bot.votes) {
      await bot.votes.registerMessage(card.id, guildId, track.url);
      for (const emoji of Object.keys(VOTE_EMOJIS)) {
        await card.react(emoji).catch(() => {});
      }
    }
  })
  .build();
