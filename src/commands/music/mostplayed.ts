import { ApplicationCommandOptionType } from "discord.js";
import { createCommand } from "@/core/commandBuilder.js";
import { EmbedColor, embed } from "@/lib/embeds.js";
import { CommandError } from "@/lib/errors.js";
import { cooldown } from "@/middlewares/cooldown.js";
import { guildOnly } from "@/middlewares/guildOnly.js";
import type { Track } from "@/services/player/track.js";

const DEFAULT_COUNT = 10;
const MAX_COUNT = 25;

export default createCommand()
  .setName("mostplayed")
  .setDescription("Queue the most played songs")
  .setPrefix("mostplayed")
  .addOption({
    name: "count",
    description: "How many songs to queue (1-25, default 10)",
    type: ApplicationCommandOptionType.Integer,
    required: false,
  })
  .use(guildOnly)
  .use(cooldown(10))
  .execute(async ({ bot, args, reply, defer, voiceChannel, textChannel, displayName, t }) => {
    if (!voiceChannel) throw new CommandError(t("errors.notInVoice"));
    if (!bot.trackCache) throw new CommandError(t("errors.dbRequired"));

    await defer();

    // voiceChannel guarantees a guild — scope the ranking to it.
    const limit = Math.min(Math.max(args.count ?? DEFAULT_COUNT, 1), MAX_COUNT);
    const top = await bot.trackCache.topPlayed(voiceChannel.guild.id, limit);

    if (top.length === 0) {
      await reply(t("music.noHistory"));
      return;
    }

    // Playback events fire detached from this interaction — announce in the
    // invoking text channel rather than via reply.
    const announce = (content: string) => {
      if (textChannel?.isSendable()) textChannel.send(content).catch(() => {});
    };
    const notifier = {
      trackStart: (track: Track) =>
        announce(t("music.nowPlaying", { title: track.title, requestedBy: track.requestedBy })),
      trackError: (track: Track) => announce(t("music.trackError", { title: track.title })),
    };

    for (const entry of top) {
      await bot.player.play(
        voiceChannel,
        { title: entry.title, url: entry.url, duration: entry.duration, requestedBy: displayName },
        notifier,
      );
    }

    const lines = top.map((entry, i) =>
      t("music.mostPlayedEntry", { position: i + 1, title: entry.title, plays: entry.plays }),
    );

    const card = embed(EmbedColor.music)
      .setTitle(t("music.mostPlayedTitle", { count: top.length }))
      .setDescription(lines.join("\n"))
      .setFooter({ text: t("music.mostPlayedFooter") });

    await reply({ embeds: [card] });
  })
  .build();
