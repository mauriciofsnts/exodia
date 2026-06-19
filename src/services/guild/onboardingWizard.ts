import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  GuildMember,
  type MessageActionRowComponentBuilder,
  type MessageComponentInteraction,
  MessageFlags,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} from "discord.js";
import type { ComponentExecutionContext } from "@/core/commandBuilder";
import { ensureGuildCommandsSynced } from "@/core/commandSync/sync";
import type { BotContext } from "@/core/context";
import { type Locale, SUPPORTED_LOCALES, type TFunction } from "@/i18n/index";
import { EmbedColor, embed } from "@/lib/embeds";
import type { EventsMode, GuildConfig } from "./guildConfig";

const PREFIX_CHOICES = ["!", "?", ".", "$", ">"];
const LOCALE_LABELS: Record<Locale, string> = { "en-US": "English", "pt-BR": "Português" };

export interface WizardPayload {
  embeds: ReturnType<typeof embed>[];
  components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

function row(
  ...components: MessageActionRowComponentBuilder[]
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(...components);
}

// Step 1/3: which language should the bot use in this server.
export function languageStep(t: TFunction): WizardPayload {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("onboard:lang")
    .setPlaceholder(t("onboarding.wizard.languagePlaceholder"))
    .addOptions(
      SUPPORTED_LOCALES.map((locale) => ({ label: LOCALE_LABELS[locale], value: locale })),
    );
  const skip = new ButtonBuilder()
    .setCustomId("onboard:lang:skip")
    .setLabel(t("onboarding.wizard.skip"))
    .setStyle(ButtonStyle.Secondary);

  return {
    embeds: [
      embed(EmbedColor.primary)
        .setTitle(t("onboarding.wizard.languageTitle"))
        .setDescription(t("onboarding.wizard.languageDesc")),
    ],
    components: [row(menu), row(skip)],
  };
}

// Step 2/3: the prefix for text (non-slash) commands.
function prefixStep(t: TFunction): WizardPayload {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("onboard:prefix")
    .setPlaceholder(t("onboarding.wizard.prefixPlaceholder"))
    .addOptions(PREFIX_CHOICES.map((p) => ({ label: p, value: p })));
  const skip = new ButtonBuilder()
    .setCustomId("onboard:prefix:skip")
    .setLabel(t("onboarding.wizard.skip"))
    .setStyle(ButtonStyle.Secondary);

  return {
    embeds: [
      embed(EmbedColor.primary)
        .setTitle(t("onboarding.wizard.prefixTitle"))
        .setDescription(t("onboarding.wizard.prefixDesc")),
    ],
    components: [row(menu), row(skip)],
  };
}

// Step 3/3: whether to auto-create Discord scheduled events.
function eventsStep(t: TFunction): WizardPayload {
  const enable = new ButtonBuilder()
    .setCustomId("onboard:events:on")
    .setLabel(t("onboarding.wizard.eventsEnable"))
    .setStyle(ButtonStyle.Success);
  const disable = new ButtonBuilder()
    .setCustomId("onboard:events:off")
    .setLabel(t("onboarding.wizard.eventsDisable"))
    .setStyle(ButtonStyle.Secondary);

  return {
    embeds: [
      embed(EmbedColor.primary)
        .setTitle(t("onboarding.wizard.eventsTitle"))
        .setDescription(t("onboarding.wizard.eventsDesc")),
    ],
    components: [row(enable, disable)],
  };
}

// Follow-up to "events enabled": embed-in-a-channel, or a native Discord event.
function eventsModeStep(t: TFunction): WizardPayload {
  const embedBtn = new ButtonBuilder()
    .setCustomId("onboard:eventsmode:embed")
    .setLabel(t("onboarding.wizard.eventsModeEmbed"))
    .setStyle(ButtonStyle.Primary);
  const discordBtn = new ButtonBuilder()
    .setCustomId("onboard:eventsmode:discord")
    .setLabel(t("onboarding.wizard.eventsModeDiscord"))
    .setStyle(ButtonStyle.Primary);

  return {
    embeds: [
      embed(EmbedColor.primary)
        .setTitle(t("onboarding.wizard.eventsModeTitle"))
        .setDescription(t("onboarding.wizard.eventsModeDesc")),
    ],
    components: [row(embedBtn, discordBtn)],
  };
}

// Follow-up to "embed" mode: which channel gets the announcements.
function eventsChannelStep(t: TFunction): WizardPayload {
  const select = new ChannelSelectMenuBuilder()
    .setCustomId("onboard:eventschannel")
    .setPlaceholder(t("onboarding.wizard.eventsChannelPlaceholder"))
    .setChannelTypes(ChannelType.GuildText);
  const skip = new ButtonBuilder()
    .setCustomId("onboard:eventschannel:skip")
    .setLabel(t("onboarding.wizard.skip"))
    .setStyle(ButtonStyle.Secondary);

  return {
    embeds: [
      embed(EmbedColor.primary)
        .setTitle(t("onboarding.wizard.eventsChannelTitle"))
        .setDescription(t("onboarding.wizard.eventsChannelDesc")),
    ],
    components: [row(select), row(skip)],
  };
}

// Follow-up to "embed" mode (after the channel is picked): ping @everyone or not.
function eventsMentionStep(t: TFunction): WizardPayload {
  const yes = new ButtonBuilder()
    .setCustomId("onboard:mention:yes")
    .setLabel(t("onboarding.wizard.mentionYes"))
    .setStyle(ButtonStyle.Danger);
  const no = new ButtonBuilder()
    .setCustomId("onboard:mention:no")
    .setLabel(t("onboarding.wizard.mentionNo"))
    .setStyle(ButtonStyle.Secondary);

  return {
    embeds: [
      embed(EmbedColor.primary)
        .setTitle(t("onboarding.wizard.mentionTitle"))
        .setDescription(t("onboarding.wizard.mentionDesc")),
    ],
    components: [row(yes, no)],
  };
}

// Final summary, with a button to run through the wizard again. Also the entry
// screen for `/setup` on a guild that already finished setup — this command is
// the single place every setting lives, so re-running it just opens here.
export function doneStep(t: TFunction, cfg: GuildConfig): WizardPayload {
  const restart = new ButtonBuilder()
    .setCustomId("onboard:restart")
    .setLabel(t("onboarding.wizard.restart"))
    .setStyle(ButtonStyle.Secondary);

  const none = t("onboarding.wizard.none");
  return {
    embeds: [
      embed(EmbedColor.success)
        .setTitle(t("onboarding.wizard.doneTitle"))
        .setDescription(t("onboarding.wizard.doneDesc"))
        .addFields(
          { name: t("onboarding.wizard.doneLang"), value: cfg.locale ?? none, inline: true },
          {
            name: t("onboarding.wizard.donePrefix"),
            value: cfg.prefix ? `\`${cfg.prefix}\`` : none,
            inline: true,
          },
          {
            name: t("onboarding.wizard.doneEvents"),
            value: cfg.eventsEnabled ? t("onboarding.wizard.on") : t("onboarding.wizard.off"),
            inline: true,
          },
          {
            name: t("onboarding.wizard.doneEventsMode"),
            value: !cfg.eventsEnabled
              ? none
              : cfg.eventsMode === "embed"
                ? t("onboarding.wizard.eventsModeEmbed")
                : t("onboarding.wizard.eventsModeDiscord"),
            inline: true,
          },
          {
            name: t("onboarding.wizard.doneEventsChannel"),
            value:
              cfg.eventsMode === "embed" && cfg.eventsChannelId
                ? `<#${cfg.eventsChannelId}>`
                : none,
            inline: true,
          },
          {
            name: t("onboarding.wizard.doneMention"),
            value:
              cfg.eventsMode === "embed"
                ? cfg.eventsMentionEveryone
                  ? t("onboarding.wizard.on")
                  : t("onboarding.wizard.off")
                : none,
            inline: true,
          },
        ),
    ],
    components: [row(restart)],
  };
}

async function finish(
  interaction: MessageComponentInteraction,
  bot: BotContext,
  guildId: string,
  t: TFunction,
): Promise<void> {
  // Acknowledge immediately — guild.commands.set() below can take longer than
  // Discord's 3s interaction window, which would otherwise expire the token
  // before we get to respond ("Unknown interaction").
  await interaction.deferUpdate();

  await bot.guildConfig.update(guildId, { configured: true });
  // The wizard just finished — make sure this guild has every command the bot
  // currently defines, even if some were added after it last synced (or it
  // never synced at all).
  if (interaction.guild) {
    await ensureGuildCommandsSynced(interaction.guild, bot).catch((err) =>
      bot.logger.error({ err, guildId }, "Failed to sync guild commands after setup"),
    );
  }
  const cfg = await bot.guildConfig.get(guildId);
  await interaction.editReply(doneStep(t, cfg));
}

// Routes every "onboard:*" button/select click. Only members who could have run
// `/setup` (Manage Server) may advance the wizard — it edits the same message in
// place, step by step, via interaction.update().
export async function handleOnboardComponent(ctx: ComponentExecutionContext): Promise<void> {
  const { interaction, bot, guildId, args } = ctx;
  if (!guildId) return;

  const member = interaction.member instanceof GuildMember ? interaction.member : null;
  if (!member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await interaction
      .reply({ content: ctx.t("onboarding.wizard.notAllowed"), flags: MessageFlags.Ephemeral })
      .catch(() => {});
    return;
  }

  const [step, action] = args;

  if (step === "lang") {
    const locale = interaction.isStringSelectMenu() ? (interaction.values[0] as Locale) : null;
    if (locale) await bot.guildConfig.update(guildId, { locale });
    await interaction.update(prefixStep(bot.i18n.bind(locale ?? ctx.locale)));
    return;
  }

  if (step === "prefix") {
    const value = interaction.isStringSelectMenu() ? interaction.values[0] : null;
    if (value) await bot.guildConfig.update(guildId, { prefix: value });
    await interaction.update(eventsStep(ctx.t));
    return;
  }

  if (step === "events") {
    if (action === "off") {
      await bot.guildConfig.update(guildId, { eventsEnabled: false });
      await finish(interaction, bot, guildId, ctx.t);
      return;
    }
    await bot.guildConfig.update(guildId, { eventsEnabled: true });
    await interaction.update(eventsModeStep(ctx.t));
    return;
  }

  if (step === "eventsmode") {
    const mode: EventsMode = action === "embed" ? "embed" : "discord";
    await bot.guildConfig.update(guildId, { eventsMode: mode });
    // Only the embed mode has a channel to pick and an @everyone option — the
    // native Discord event mode notifies on its own.
    if (mode === "embed") {
      await interaction.update(eventsChannelStep(ctx.t));
    } else {
      await finish(interaction, bot, guildId, ctx.t);
    }
    return;
  }

  if (step === "eventschannel") {
    if (action !== "skip" && interaction.isChannelSelectMenu()) {
      await bot.guildConfig.update(guildId, { eventsChannelId: interaction.values[0] });
    }
    await interaction.update(eventsMentionStep(ctx.t));
    return;
  }

  if (step === "mention") {
    await bot.guildConfig.update(guildId, { eventsMentionEveryone: action === "yes" });
    await finish(interaction, bot, guildId, ctx.t);
    return;
  }

  if (step === "restart") {
    await interaction.update(languageStep(ctx.t));
  }
}
