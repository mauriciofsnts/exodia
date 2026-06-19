import { ApplicationCommandOptionType } from "discord.js";
import { createCommand } from "@/core/commandBuilder";
import { CommandError } from "@/lib/errors";

export default createCommand()
  .setName("volume")
  .setDescription("Show or set playback volume (0-200%)")
  .setPrefix("volume")
  .addOption({
    name: "level",
    description: "Volume percent 0-200 (omit to show the current value)",
    type: ApplicationCommandOptionType.Integer,
    required: false,
  })
  .execute(async ({ bot, args, reply, guildId, t }) => {
    if (!guildId) throw new CommandError(t("errors.guildOnly"));

    if (args.level === null) {
      await reply(t("music.volumeCurrent", { level: bot.player.getVolume(guildId) }));
      return;
    }

    const applied = bot.player.setVolume(guildId, args.level);
    await reply(t("music.volumeSet", { level: applied }));
  })
  .build();
