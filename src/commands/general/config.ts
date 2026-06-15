import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { createCommand } from "@/core/commandBuilder.js";
import { DEFAULT_LOCALE, type Locale, SUPPORTED_LOCALES } from "@/i18n/index.js";
import { CommandError } from "@/lib/errors.js";
import { guildOnly } from "@/middlewares/guildOnly.js";
import { requirePermission } from "@/middlewares/requirePermission.js";
import { resumeOnboarding } from "@/services/guild/onboarding.js";

const MAX_PREFIX_LENGTH = 5;

function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as string[]).includes(value);
}

export default createCommand()
  .setName("config")
  .setDescription("Configure the bot for this server")
  .setPrefix("config")
  .addOption({
    name: "action",
    description: "What to configure",
    type: ApplicationCommandOptionType.String,
    required: false,
    choices: [
      { name: "show", value: "show" },
      { name: "prefix", value: "prefix" },
      { name: "lang", value: "lang" },
      { name: "resume", value: "resume" },
    ],
  })
  .addOption({
    name: "value",
    description: "New value (for prefix / lang)",
    type: ApplicationCommandOptionType.String,
    required: false,
  })
  .use(guildOnly)
  .use(requirePermission(PermissionFlagsBits.ManageGuild))
  .execute(async ({ bot, args, guildId, reply, textChannel, t }) => {
    if (!guildId) throw new CommandError(t("errors.guildOnly"));

    const prefix = await bot.guildConfig.resolvePrefix(guildId);
    const action = args.action ?? "show";

    if (action === "prefix") {
      const value = args.value?.trim();
      if (!value) throw new CommandError(t("commands.config.needValue", { prefix, action }));
      if (value.length > MAX_PREFIX_LENGTH || /\s/.test(value)) {
        throw new CommandError(t("commands.config.invalidPrefix"));
      }
      await bot.guildConfig.update(guildId, { prefix: value });
      await reply(t("commands.config.prefixSet", { prefix: value }));
      return;
    }

    if (action === "lang") {
      const value = args.value?.trim();
      if (!value) throw new CommandError(t("commands.config.needValue", { prefix, action }));
      if (!isLocale(value)) {
        const langs = SUPPORTED_LOCALES.join(", ");
        throw new CommandError(t("commands.config.invalidLang", { langs }));
      }
      await bot.guildConfig.update(guildId, { locale: value });
      await reply(t("commands.config.langSet", { lang: value }));
      return;
    }

    if (action === "resume") {
      const guild = bot.client.guilds.cache.get(guildId);
      if (!guild) throw new CommandError(t("errors.generic"));
      if (!textChannel?.isSendable()) throw new CommandError(t("errors.generic"));

      const channel = await resumeOnboarding(guild, bot, textChannel);
      await reply(
        channel
          ? t("commands.config.resumeReady", { channel: `<#${channel.id}>` })
          : t("commands.config.resumeHere"),
      );
      return;
    }

    // show: current settings + how to change them
    const cfg = await bot.guildConfig.get(guildId);
    const lang = cfg.locale ?? DEFAULT_LOCALE;
    await reply(
      [
        `**${t("commands.config.title")}**`,
        t("commands.config.current", { prefix, lang }),
        t("commands.config.help", { prefix }),
      ].join("\n"),
    );
  })
  .build();
