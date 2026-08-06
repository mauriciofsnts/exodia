import { createCommand } from "@/core/commandBuilder";
import { CommandError } from "@/lib/errors";
import { adminOnly } from "@/middlewares/adminOnly";
import { cooldown } from "@/middlewares/cooldown";
import { guildOnly } from "@/middlewares/guildOnly";

const COOLDOWN_SECONDS = 60; // guards the football-data.org / TheSportsDB rate limits

// Operational tool, not a user-facing feature — prefix-only so it doesn't take
// a slash-command slot, and restricted to the bot admin (not per-guild
// managers) since it burns provider rate limit budget shared across every
// guild. Bypasses the importer's 30-min fetch cache for this guild's football
// subscriptions so a fresh fixture list (see /events) shows up immediately
// instead of waiting for the next scheduled import.
export default createCommand()
  .setName("importfootball")
  .setDescription("Force-refresh this server's subscribed football fixtures right now")
  .setPrefix("importfootball")
  .setSlash(false)
  .use(guildOnly)
  .use(adminOnly)
  .use(cooldown(COOLDOWN_SECONDS))
  .execute(async ({ bot, guildId, reply, defer, t }) => {
    if (!guildId) throw new CommandError(t("errors.guildOnly"));
    if (!bot.sportsImporter) throw new CommandError(t("errors.dbRequired"));

    await defer();

    const { leagues, fixtures } = await bot.sportsImporter.forceFootballImport(guildId);
    if (leagues === 0) {
      await reply(t("commands.importFootball.noSubs"));
      return;
    }

    await reply(t("commands.importFootball.done", { leagues, fixtures }));
  })
  .build();
