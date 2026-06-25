import { createCommand } from "@/core/commandBuilder";
import { embed } from "@/lib/embeds";
import { CommandError } from "@/lib/errors";
import { guildOnly } from "@/middlewares/guildOnly";

const LEADERBOARD_LIMIT = 10;

// Ranks this server's members by coin balance — the read view over the economy.
export default createCommand()
  .setName("leaderboard")
  .setDescription("Show the richest members in this server")
  .setPrefix("leaderboard")
  .use(guildOnly)
  .execute(async ({ bot, guildId, reply, t }) => {
    if (!guildId) throw new CommandError(t("errors.guildOnly"));
    if (!bot.economy) throw new CommandError(t("errors.dbRequired"));

    const top = await bot.economy.leaderboard(guildId, LEADERBOARD_LIMIT);
    if (top.length === 0) {
      await reply(t("economy.leaderboardEmpty"));
      return;
    }

    const lines = top.map((entry, i) =>
      t("economy.leaderboardEntry", {
        rank: i + 1,
        user: `<@${entry.userId}>`,
        balance: entry.balance,
      }),
    );

    const card = embed()
      .setTitle(t("economy.leaderboardTitle"))
      .setDescription(lines.join("\n"))
      .setFooter({ text: t("economy.leaderboardFooter", { count: top.length }) });

    await reply({ embeds: [card] });
  })
  .build();
