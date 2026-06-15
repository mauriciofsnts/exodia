import { ApplicationCommandOptionType } from "discord.js";
import { search, type YouTubeVideo } from "play-dl";
import { createCommand } from "@/core/commandBuilder.js";
import { CommandError } from "@/lib/errors.js";

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
  .execute(async ({ bot, args, reply, voiceChannel, displayName, t }) => {
    if (!voiceChannel) throw new CommandError(t("errors.notInVoice"));

    await reply(t("music.searching"));

    const results = await search(args.query, { source: { youtube: "video" }, limit: 1 });
    // play-dl returns a union that collapses to never — cast to the expected type
    const video = results[0] as YouTubeVideo | undefined;

    if (!video?.url) throw new CommandError(t("errors.noResults"));

    await bot.player.play(voiceChannel, {
      title: video.title ?? "Unknown",
      url: video.url,
      duration: video.durationInSec ?? 0,
      requestedBy: displayName,
    });

    await reply(t("music.addedToQueue", { title: video.title ?? "Unknown" }));
  })
  .build();
