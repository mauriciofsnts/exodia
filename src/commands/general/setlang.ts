import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { createCommand } from "@/core/commandBuilder.js";
import { guildLocaleKey, type Locale, SUPPORTED_LOCALES } from "@/i18n/index.js";
import { CommandError } from "@/lib/errors.js";

const LOCALE_LABELS: Record<Locale, string> = {
  "en-US": "English",
  "pt-BR": "Português (Brasil)",
};

export default createCommand()
  .setName("setlang")
  .setDescription("Set the server language")
  .setPrefix("setlang")
  .addOption({
    name: "lang",
    description: "Language to use in this server",
    type: ApplicationCommandOptionType.String,
    required: true,
    choices: SUPPORTED_LOCALES.map((locale) => ({ name: LOCALE_LABELS[locale], value: locale })),
  })
  .execute(async ({ source, guildId, memberPermissions, args, bot, reply, t }) => {
    if (source !== "guild" || !guildId) throw new CommandError(t("errors.guildOnly"));

    if (!memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      throw new CommandError(t("commands.setlang.noPermission"));
    }

    await bot.cache.set(guildLocaleKey(guildId), args.lang);

    await reply(t("commands.setlang.success", { lang: LOCALE_LABELS[args.lang] }));
  })
  .build();
