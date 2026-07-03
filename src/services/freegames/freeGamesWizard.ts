import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  GuildMember,
  type MessageActionRowComponentBuilder,
  MessageFlags,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} from "discord.js";
import type { ComponentExecutionContext } from "@/core/commandBuilder";
import type { TFunction } from "@/i18n/index";
import { EmbedColor, embed } from "@/lib/embeds";
import type { GuildConfig } from "@/services/guild/guildConfig";
import { storeLabel } from "./freeGameCard";
import { FREE_GAME_STORES } from "./index";
import type { FreeGameStore } from "./types";

interface WizardPayload {
  embeds: ReturnType<typeof embed>[];
  components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

function row(
  ...components: MessageActionRowComponentBuilder[]
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(...components);
}

function summarizeStores(t: TFunction, stores: FreeGameStore[] | undefined): string {
  const active = stores ?? FREE_GAME_STORES;
  return active.map((store) => storeLabel(t, store)).join(", ");
}

// Entry screen: current config + the path into the setup flow. Doubles as the
// "current settings" view, like the sports wizard's sport step.
export function setupStep(t: TFunction, cfg: GuildConfig): WizardPayload {
  const configure = new ButtonBuilder()
    .setCustomId("freegames:channelstep")
    .setLabel(t("commands.freegames.wizard.configure"))
    .setStyle(ButtonStyle.Primary);
  const disable = new ButtonBuilder()
    .setCustomId("freegames:disable")
    .setLabel(t("commands.freegames.wizard.disable"))
    .setStyle(ButtonStyle.Danger);
  const close = new ButtonBuilder()
    .setCustomId("freegames:close")
    .setLabel(t("commands.freegames.wizard.close"))
    .setStyle(ButtonStyle.Secondary);

  const none = t("commands.freegames.wizard.none");
  const buttons = cfg.freeGamesEnabled ? [configure, disable, close] : [configure, close];

  return {
    embeds: [
      embed(EmbedColor.freegames)
        .setTitle(t("commands.freegames.wizard.setupTitle"))
        .setDescription(t("commands.freegames.wizard.setupDesc"))
        .addFields(
          {
            name: t("commands.freegames.wizard.current"),
            value: cfg.freeGamesEnabled
              ? t("commands.freegames.wizard.on")
              : t("commands.freegames.wizard.off"),
            inline: true,
          },
          {
            name: t("commands.freegames.wizard.channel"),
            value: cfg.freeGamesChannelId ? `<#${cfg.freeGamesChannelId}>` : none,
            inline: true,
          },
          {
            name: t("commands.freegames.wizard.stores"),
            value: summarizeStores(t, cfg.freeGamesStores),
            inline: true,
          },
          {
            name: t("commands.freegames.wizard.mention"),
            value: cfg.freeGamesMentionEveryone
              ? t("commands.freegames.wizard.on")
              : t("commands.freegames.wizard.off"),
            inline: true,
          },
        ),
    ],
    components: [row(...buttons)],
  };
}

// Step 1: which channel gets the free-game posts.
function channelStep(t: TFunction): WizardPayload {
  const select = new ChannelSelectMenuBuilder()
    .setCustomId("freegames:channel")
    .setPlaceholder(t("commands.freegames.wizard.channelPlaceholder"))
    .setChannelTypes(ChannelType.GuildText);

  return {
    embeds: [
      embed(EmbedColor.freegames)
        .setTitle(t("commands.freegames.wizard.channelTitle"))
        .setDescription(t("commands.freegames.wizard.channelDesc")),
    ],
    components: [row(select)],
  };
}

// Step 2: which stores to announce, pre-checked with the current filter.
function storesStep(t: TFunction, cfg: GuildConfig): WizardPayload {
  const active = new Set(cfg.freeGamesStores ?? FREE_GAME_STORES);
  const menu = new StringSelectMenuBuilder()
    .setCustomId("freegames:stores")
    .setPlaceholder(t("commands.freegames.wizard.storesPlaceholder"))
    .setMinValues(1)
    .setMaxValues(FREE_GAME_STORES.length)
    .addOptions(
      FREE_GAME_STORES.map((store) => ({
        label: storeLabel(t, store),
        value: store,
        default: active.has(store),
      })),
    );

  return {
    embeds: [
      embed(EmbedColor.freegames)
        .setTitle(t("commands.freegames.wizard.storesTitle"))
        .setDescription(t("commands.freegames.wizard.storesDesc")),
    ],
    components: [row(menu)],
  };
}

// Step 3: ping @everyone or not. Saving this step is what enables the feature.
function mentionStep(t: TFunction): WizardPayload {
  const yes = new ButtonBuilder()
    .setCustomId("freegames:mention:yes")
    .setLabel(t("commands.freegames.wizard.mentionYes"))
    .setStyle(ButtonStyle.Danger);
  const no = new ButtonBuilder()
    .setCustomId("freegames:mention:no")
    .setLabel(t("commands.freegames.wizard.mentionNo"))
    .setStyle(ButtonStyle.Secondary);

  return {
    embeds: [
      embed(EmbedColor.freegames)
        .setTitle(t("commands.freegames.wizard.mentionTitle"))
        .setDescription(t("commands.freegames.wizard.mentionDesc")),
    ],
    components: [row(yes, no)],
  };
}

// Final summary, no components — closes the wizard.
function doneStep(t: TFunction, cfg: GuildConfig): WizardPayload {
  const none = t("commands.freegames.wizard.none");
  return {
    embeds: [
      embed(EmbedColor.success)
        .setTitle(t("commands.freegames.wizard.doneTitle"))
        .setDescription(t("commands.freegames.wizard.doneDesc"))
        .addFields(
          {
            name: t("commands.freegames.wizard.channel"),
            value: cfg.freeGamesChannelId ? `<#${cfg.freeGamesChannelId}>` : none,
            inline: true,
          },
          {
            name: t("commands.freegames.wizard.stores"),
            value: summarizeStores(t, cfg.freeGamesStores),
            inline: true,
          },
          {
            name: t("commands.freegames.wizard.mention"),
            value: cfg.freeGamesMentionEveryone
              ? t("commands.freegames.wizard.on")
              : t("commands.freegames.wizard.off"),
            inline: true,
          },
        ),
    ],
    components: [],
  };
}

// Routes every "freegames:*" button/select click. Every step mutates guild
// config, so Manage Server is re-checked here — component handlers run outside
// command middleware, and the setup button sits on a public listing message.
export async function handleFreeGamesComponent(ctx: ComponentExecutionContext): Promise<void> {
  const { interaction, bot, guildId, args } = ctx;
  if (!guildId) return;

  const member = interaction.member instanceof GuildMember ? interaction.member : null;
  if (!member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await interaction
      .reply({
        content: ctx.t("commands.freegames.wizard.notAllowed"),
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => {});
    return;
  }

  const [step, value] = args;

  // Entry from the public /freegames listing — reply ephemerally instead of
  // hijacking the shared list message.
  if (step === "setup") {
    if (!bot.freeGames) {
      await interaction.reply({
        content: ctx.t("errors.dbRequired"),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const cfg = await bot.guildConfig.get(guildId);
    await interaction.reply({ ...setupStep(ctx.t, cfg), flags: MessageFlags.Ephemeral });
    return;
  }

  if (step === "channelstep") {
    await interaction.update(channelStep(ctx.t));
    return;
  }

  if (step === "channel") {
    if (!interaction.isChannelSelectMenu()) return;
    const cfg = await bot.guildConfig.update(guildId, {
      freeGamesChannelId: interaction.values[0],
    });
    await interaction.update(storesStep(ctx.t, cfg));
    return;
  }

  if (step === "stores") {
    if (!interaction.isStringSelectMenu()) return;
    await bot.guildConfig.update(guildId, {
      freeGamesStores: interaction.values as FreeGameStore[],
    });
    await interaction.update(mentionStep(ctx.t));
    return;
  }

  if (step === "mention") {
    const cfg = await bot.guildConfig.update(guildId, {
      freeGamesMentionEveryone: value === "yes",
      freeGamesEnabled: true,
    });
    await interaction.update(doneStep(ctx.t, cfg));
    return;
  }

  if (step === "disable") {
    const cfg = await bot.guildConfig.update(guildId, { freeGamesEnabled: false });
    await interaction.update(setupStep(ctx.t, cfg));
    return;
  }

  if (step === "close") {
    const cfg = await bot.guildConfig.get(guildId);
    await interaction.update({ ...setupStep(ctx.t, cfg), components: [] });
  }
}
