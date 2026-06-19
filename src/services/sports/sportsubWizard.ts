import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  GuildMember,
  type MessageActionRowComponentBuilder,
  MessageFlags,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} from "discord.js";
import type { ComponentExecutionContext } from "@/core/commandBuilder";
import type { TFunction } from "@/i18n/index";
import { EmbedColor, embed } from "@/lib/embeds";
import { SPORTS_CATALOG, type Sport } from "./catalog";

const SPORTS: Sport[] = ["football", "basketball", "f1"];

interface WizardPayload {
  embeds: ReturnType<typeof embed>[];
  components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

function row(
  ...components: MessageActionRowComponentBuilder[]
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(...components);
}

function sportLabel(t: TFunction, sport: Sport): string {
  return t(`commands.sportsub.wizard.sport.${sport}` as Parameters<TFunction>[0]);
}

function leaguesBySport(sport: Sport): Array<{ key: string; label: string }> {
  return Object.entries(SPORTS_CATALOG)
    .filter(([, league]) => league.sport === sport)
    .map(([key, league]) => ({ key, label: league.label }));
}

function summarize(t: TFunction, subs: string[]): string {
  if (subs.length === 0) return t("commands.sportsub.wizard.none");
  return subs.map((key) => SPORTS_CATALOG[key]?.label ?? key).join(", ");
}

// Step 1: pick a sport. Shows the current subscriptions across every sport so
// the wizard doubles as a "list" view.
export function sportStep(t: TFunction, subs: string[]): WizardPayload {
  const buttons = SPORTS.map((sport) =>
    new ButtonBuilder()
      .setCustomId(`sportsub:sport:${sport}`)
      .setLabel(sportLabel(t, sport))
      .setStyle(ButtonStyle.Primary),
  );
  const done = new ButtonBuilder()
    .setCustomId("sportsub:done")
    .setLabel(t("commands.sportsub.wizard.done"))
    .setStyle(ButtonStyle.Secondary);

  return {
    embeds: [
      embed(EmbedColor.sports)
        .setTitle(t("commands.sportsub.wizard.sportTitle"))
        .setDescription(t("commands.sportsub.wizard.sportDesc"))
        .addFields({ name: t("commands.sportsub.wizard.current"), value: summarize(t, subs) }),
    ],
    components: [row(...buttons), row(done)],
  };
}

// Step 2: pick which leagues of that sport to subscribe to. A multi-select
// pre-checked with the current subscriptions — submitting replaces this
// sport's subscriptions with exactly what's selected (deselecting all unsubs).
export function leagueStep(t: TFunction, sport: Sport, subs: string[]): WizardPayload {
  const leagues = leaguesBySport(sport);
  const subscribed = new Set(subs);

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`sportsub:leagues:${sport}`)
    .setPlaceholder(t("commands.sportsub.wizard.leaguePlaceholder"))
    .setMinValues(0)
    .setMaxValues(leagues.length)
    .addOptions(
      leagues.map((league) => ({
        label: league.label,
        value: league.key,
        default: subscribed.has(league.key),
      })),
    );
  const back = new ButtonBuilder()
    .setCustomId("sportsub:back")
    .setLabel(t("commands.sportsub.wizard.back"))
    .setStyle(ButtonStyle.Secondary);

  return {
    embeds: [
      embed(EmbedColor.sports)
        .setTitle(t("commands.sportsub.wizard.leagueTitle", { sport: sportLabel(t, sport) }))
        .setDescription(t("commands.sportsub.wizard.leagueDesc")),
    ],
    components: [row(menu), row(back)],
  };
}

// Final screen: just the summary, no components — closes the wizard.
export function doneStep(t: TFunction, subs: string[]): WizardPayload {
  return {
    embeds: [
      embed(EmbedColor.success)
        .setTitle(t("commands.sportsub.wizard.doneTitle"))
        .addFields({ name: t("commands.sportsub.wizard.current"), value: summarize(t, subs) }),
    ],
    components: [],
  };
}

// Routes every "sportsub:*" button/select click. Edits the same message in
// place, like the onboarding wizard. Only Manage Server members may use it —
// the command that opens the wizard already requires that permission, but
// component handlers run outside command middleware, so it's re-checked here.
export async function handleSportsubComponent(ctx: ComponentExecutionContext): Promise<void> {
  const { interaction, bot, guildId, args } = ctx;
  if (!guildId) return;

  const member = interaction.member instanceof GuildMember ? interaction.member : null;
  if (!member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await interaction
      .reply({
        content: ctx.t("commands.sportsub.wizard.notAllowed"),
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => {});
    return;
  }

  const [step, value] = args;
  const subs = (await bot.guildConfig.get(guildId)).sportsSubscriptions ?? [];

  if (step === "sport") {
    await interaction.update(leagueStep(ctx.t, value as Sport, subs));
    return;
  }

  if (step === "leagues") {
    if (!interaction.isStringSelectMenu()) return;
    const sport = value as Sport;
    const keepOtherSports = subs.filter((key) => SPORTS_CATALOG[key]?.sport !== sport);
    const next = [...keepOtherSports, ...interaction.values];
    await bot.guildConfig.update(guildId, { sportsSubscriptions: next });
    await interaction.update(sportStep(ctx.t, next));
    return;
  }

  if (step === "back") {
    await interaction.update(sportStep(ctx.t, subs));
    return;
  }

  if (step === "done") {
    await interaction.update(doneStep(ctx.t, subs));
  }
}
