import { randomUUID } from "node:crypto";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  MessageFlags,
  StringSelectMenuBuilder,
  type TextBasedChannel,
} from "discord.js";
import {
  type ComponentExecutionContext,
  createCommand,
  type ReactionExecutionContext,
} from "@/core/commandBuilder";
import type { TFunction } from "@/i18n/index";
import { EmbedColor, embed } from "@/lib/embeds";
import { CommandError, PlayerError } from "@/lib/errors";
import { cooldown } from "@/middlewares/cooldown";
import { guildOnly } from "@/middlewares/guildOnly";
import { cached } from "@/services/cache/cached";
import { VOTE_EMOJIS } from "@/services/music/voteRepository";
import { formatDuration, playCard, seedVotes } from "@/services/player/playCard";
import type { PlayerNotifier } from "@/services/player/playerManager";
import type { Track } from "@/services/player/track";
import type { SearchResult } from "@/services/player/youtubeSearch";
import { youtubeSuggest } from "@/services/player/youtubeSuggest";

const SEARCH_RESULTS = 5; // options shown in the picker
const SEARCH_TTL = 120; // seconds a pending search stays selectable
const AUTO_SELECT_MS = 10_000; // pick the best match if no one chooses in time
const searchKey = (token: string) => `music:search:${token}`;

// Cached payload for a pending search, keyed by the token in the select customId.
interface SearchSession {
  userId: string; // only the requester may pick
  query: string; // original query — saved as an alias once a track is chosen
  results: SearchResult[];
}

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

// Announces detached playback events (they fire outside the interaction) in the
// channel the command was used in.
function makeNotifier(channel: TextBasedChannel | null, t: TFunction): PlayerNotifier {
  const announce = (content: string) => {
    if (channel?.isSendable()) channel.send(content).catch(() => {});
  };
  return {
    trackStart: (track) =>
      announce(t("music.nowPlaying", { title: track.title, requestedBy: track.requestedBy })),
    trackError: (track) => announce(t("music.trackError", { title: track.title })),
  };
}

// The selection prompt: lists the candidates and a select menu to pick one.
function searchCard(token: string, results: SearchResult[], query: string, t: TFunction) {
  const prompt = embed(EmbedColor.music)
    .setTitle(t("music.searchPrompt", { query }))
    .setDescription(
      results
        .map(
          (r, i) =>
            `\`${i + 1}.\` ${r.title}${r.duration > 0 ? ` — \`${formatDuration(r.duration)}\`` : ""}`,
        )
        .join("\n"),
    )
    .setFooter({ text: t("music.searchAutoHint", { seconds: AUTO_SELECT_MS / 1000 }) });

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`musicpick:${token}`)
    .setPlaceholder(t("music.searchPlaceholder"))
    .addOptions(
      results.map((r, i) => ({
        label: r.title.slice(0, 100),
        description: r.duration > 0 ? formatDuration(r.duration) : undefined,
        value: String(i),
      })),
    );

  return {
    embeds: [prompt],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
  };
}

// Playback control buttons on the play card. The "music" customId prefix routes
// every button here; the action lives in the first customId segment (args[0]).
async function handleMusicButton(ctx: ComponentExecutionContext): Promise<void> {
  if (!ctx.guildId) return;
  const action = ctx.args[0];
  try {
    let message: string;
    switch (action) {
      case "pause":
        message = ctx.bot.player.togglePause(ctx.guildId)
          ? ctx.t("music.paused")
          : ctx.t("music.resumed");
        break;
      case "skip":
        ctx.bot.player.skip(ctx.guildId);
        message = ctx.t("music.skipped");
        break;
      case "shuffle":
        ctx.bot.player.shuffle(ctx.guildId);
        message = ctx.t("music.shuffled");
        break;
      case "stop":
        ctx.bot.player.stop(ctx.guildId);
        message = ctx.t("music.stopped");
        break;
      default:
        return;
    }
    await ctx.interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
  } catch (err) {
    const message = err instanceof PlayerError ? err.message : ctx.t("errors.generic");
    await ctx.interaction
      .reply({ content: `❌ ${message}`, flags: MessageFlags.Ephemeral })
      .catch(() => {});
    // Unexpected (non-user-facing) errors bubble up so the loader notifies the admin.
    if (!(err instanceof PlayerError) && !(err instanceof CommandError)) throw err;
  }
}

// Resolves a song picked from the search menu, starts playback, and replaces the
// menu with the play card. Routed by the "musicpick" customId prefix.
async function handleSongSelect(ctx: ComponentExecutionContext): Promise<void> {
  const { bot, interaction, t } = ctx;
  if (!interaction.isStringSelectMenu() || !ctx.guildId) return;

  // Streaming can exceed the 3s ack window — acknowledge the click first, then
  // edit the message in once playback is ready.
  await interaction.deferUpdate();
  const fail = (key: Parameters<TFunction>[0]) =>
    interaction.followUp({ content: t(key), flags: MessageFlags.Ephemeral }).then(() => {});

  const raw = await bot.cache.get(searchKey(ctx.args[0]));
  if (!raw) return fail("music.searchExpired");

  const session = JSON.parse(raw) as SearchSession;
  if (interaction.user.id !== session.userId) return fail("music.notYourSearch");

  const chosen = session.results[Number(interaction.values[0])];
  if (!chosen) return fail("errors.generic");

  const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
  const voiceChannel = member?.voice.channel ?? null;
  if (!voiceChannel) return fail("errors.notInVoice");

  // Claim the session: deleting the token is the lock. If it's already gone, the
  // 10s auto-select (or a prior pick) won — back off.
  const claimed = await bot.cache.del(searchKey(ctx.args[0]));
  if (!claimed) return fail("music.searchExpired");

  const track: Track = { ...chosen, requestedBy: interaction.user.displayName };
  // Remember the query → track alias so the same search plays instantly next time.
  await bot.trackCache?.save(ctx.guildId, session.query, track);

  try {
    await bot.player.play(voiceChannel, track, makeNotifier(interaction.channel, t));
  } catch (err) {
    const msg = err instanceof PlayerError ? err.message : t("errors.generic");
    await interaction
      .followUp({ content: `❌ ${msg}`, flags: MessageFlags.Ephemeral })
      .catch(() => {});
    // Surface unexpected faults to the loader (→ admin notifier); PlayerErrors are
    // user-facing and stop here.
    if (!(err instanceof PlayerError) && !(err instanceof CommandError)) throw err;
    return;
  }

  const upcoming = bot.player.getQueue(ctx.guildId)?.list ?? [];
  await interaction.editReply(playCard(track, track.requestedBy, upcoming, t));
  await seedVotes(bot, interaction.message, ctx.guildId, track.url);
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
    autocomplete: async ({ bot, value }) => {
      if (!value.trim()) return [];
      const suggestions = await cached(bot.cache, `ac:yt:${value.toLowerCase()}`, 120, () =>
        youtubeSuggest(value),
      ).catch(() => [] as string[]);
      return suggestions
        .slice(0, 25)
        .map((s) => ({ name: s.slice(0, 100), value: s.slice(0, 100) }));
    },
  })
  .use(guildOnly)
  .use(cooldown(3))
  .onReaction(handleVoteReaction, Object.keys(VOTE_EMOJIS))
  .onComponent("music", handleMusicButton)
  .onComponent("musicpick", handleSongSelect)
  .execute(
    async ({ bot, args, respond, defer, voiceChannel, textChannel, displayName, userId, t }) => {
      if (!voiceChannel) throw new CommandError(t("errors.notInVoice"));

      // Search + stream resolution can exceed Discord's 3s window — defer first.
      await defer();

      // voiceChannel guarantees a guild, so its id is the per-guild cache scope.
      const guildId = voiceChannel.guild.id;
      const isUrl = /^https?:\/\//i.test(args.query.trim());

      // Direct play when there's no ambiguity: an explicit URL, or a query we've
      // resolved before (cache hit). Free-text searches go through the picker.
      const cachedTrack = isUrl ? null : await bot.trackCache?.find(guildId, args.query);

      if (isUrl || cachedTrack) {
        let track: Track;
        if (cachedTrack) {
          track = { ...cachedTrack, requestedBy: displayName };
        } else {
          const result = await bot.player.search(args.query);
          if (!result) throw new CommandError(t("errors.noResults"));
          track = { ...result, requestedBy: displayName };
          await bot.trackCache?.save(guildId, args.query, track);
        }

        await bot.player.play(voiceChannel, track, makeNotifier(textChannel, t));
        const upcoming = bot.player.getQueue(guildId)?.list ?? [];
        const message = await respond(playCard(track, displayName, upcoming, t));
        await seedVotes(bot, message, guildId, track.url);
        return;
      }

      // Free-text search → let the user choose from a few candidates.
      const results = await bot.player.searchMany(args.query, SEARCH_RESULTS);
      if (results.length === 0) throw new CommandError(t("errors.noResults"));

      const token = randomUUID();
      const session: SearchSession = { userId, query: args.query, results };
      await bot.cache.set(searchKey(token), JSON.stringify(session), "EX", SEARCH_TTL);

      const menuMessage = await respond(searchCard(token, results, args.query, t));

      // Best-effort: join now so the intro signals we're connected while they pick
      // and the track downloads. Real connection errors surface on play() after
      // selection, so just log a failure here.
      bot.player
        .join(voiceChannel)
        .catch((err) => bot.logger.error({ err, guildId }, "early voice join failed"));

      // Auto-pick the best match (results[0]) if no one selects in time. Deleting
      // the token is the lock: a user pick and this timer race to consume it, and
      // whoever fails the delete backs off — so the track plays exactly once.
      setTimeout(() => {
        void (async () => {
          const claimed = await bot.cache.del(searchKey(token)).catch(() => 0);
          if (!claimed) return; // already chosen

          const track: Track = { ...results[0], requestedBy: displayName };
          try {
            await bot.trackCache?.save(guildId, args.query, track);
            await bot.player.play(voiceChannel, track, makeNotifier(textChannel, t));
            const upcoming = bot.player.getQueue(guildId)?.list ?? [];
            await menuMessage.edit(playCard(track, displayName, upcoming, t));
            await seedVotes(bot, menuMessage, guildId, track.url);
          } catch (err) {
            bot.logger.error({ err, guildId }, "auto-select playback failed");
          }
        })();
      }, AUTO_SELECT_MS);
    },
  )
  .build();
