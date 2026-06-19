import { createCommand } from "@/core/commandBuilder";
import { CommandError } from "@/lib/errors";
import { playCard, seedVotes } from "@/services/player/playCard";

export default createCommand()
  .setName("nowplaying")
  .setDescription("Show the current song with like/dislike reactions")
  .setPrefix("nowplaying")
  .execute(async ({ bot, respond, reply, guildId, t }) => {
    if (!guildId) throw new CommandError(t("errors.guildOnly"));

    const current = bot.player.getCurrent(guildId);
    if (!current) {
      await reply(t("music.nothingPlaying"));
      return;
    }

    const upcoming = bot.player.getQueue(guildId)?.list ?? [];
    const headline = `▶️ ${t("music.queueNowPlaying")}`;
    const message = await respond(playCard(current, current.requestedBy, upcoming, t, headline));

    // Same vote card as /play, so 👍 👎 ⭐ feed the /mostplayed ranking.
    await seedVotes(bot, message, guildId, current.url);
  })
  .build();
