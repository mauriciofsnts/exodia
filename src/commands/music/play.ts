import { ApplicationCommandOptionType } from "discord.js";
import { search, type YouTubeVideo } from "play-dl";
import { createCommand } from "@/core/commandBuilder.js";
import { CommandError } from "@/lib/errors.js";
import { cooldown } from "@/middlewares/cooldown.js";
import { guildOnly } from "@/middlewares/guildOnly.js";
import type { Track } from "@/services/player/track.js";

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
  .execute(async ({ bot, args, reply, defer, voiceChannel, textChannel, displayName, t }) => {
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

    await reply(t("music.addedToQueue", { title: track.title }));
  })
  .build();
