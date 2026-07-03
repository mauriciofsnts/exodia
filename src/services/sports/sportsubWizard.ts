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
import type { SportsSubMode } from "@/services/guild/guildConfig";
import { SPORTS_CATALOG, type Sport } from "./catalog";

const SPORTS: Sport[] = ["football", "basketball", "f1"];

type SubModes = Record<string, SportsSubMode>;

// Missing entry = "all" — subscriptions made before modes existed announce
// every match, exactly as they always did.
function modeOf(modes: SubModes, key: string): SportsSubMode {
  return modes[key] ?? "all";
}

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

function summarize(t: TFunction, subs: string[], modes: SubModes): string {
  if (subs.length === 0) return t("commands.sportsub.wizard.none");
  return subs
    .map((key) => {
      const label = SPORTS_CATALOG[key]?.label ?? key;
      return modeOf(modes, key) === "follow"
        ? `${label} (${t("commands.sportsub.wizard.followTag")})`
        : label;
    })
    .join(", ");
}

// Step 1: pick a sport. Shows the current subscriptions across every sport so
// the wizard doubles as a "list" view.
export function sportStep(t: TFunction, subs: string[], modes: SubModes): WizardPayload {
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
        .addFields({
          name: t("commands.sportsub.wizard.current"),
          value: summarize(t, subs, modes),
        }),
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

// Step 3: per-league announcement mode for the sport just configured. Leagues
// selected in the multi-select announce every match ("all"); the rest go
// follow-only — new fixtures are posted as a digest and only followed matches
// get the reminder/start pings.
export function modeStep(
  t: TFunction,
  sport: Sport,
  subs: string[],
  modes: SubModes,
): WizardPayload {
  const leagues = leaguesBySport(sport).filter(({ key }) => subs.includes(key));

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`sportsub:modes:${sport}`)
    .setPlaceholder(t("commands.sportsub.wizard.modePlaceholder"))
    .setMinValues(0)
    .setMaxValues(leagues.length)
    .addOptions(
      leagues.map((league) => ({
        label: league.label,
        value: league.key,
        default: modeOf(modes, league.key) === "all",
      })),
    );

  return {
    embeds: [
      embed(EmbedColor.sports)
        .setTitle(t("commands.sportsub.wizard.modeTitle", { sport: sportLabel(t, sport) }))
        .setDescription(t("commands.sportsub.wizard.modeDesc")),
    ],
    components: [row(menu)],
  };
}

// Final screen: just the summary, no components — closes the wizard.
export function doneStep(t: TFunction, subs: string[], modes: SubModes): WizardPayload {
  return {
    embeds: [
      embed(EmbedColor.success)
        .setTitle(t("commands.sportsub.wizard.doneTitle"))
        .addFields({
          name: t("commands.sportsub.wizard.current"),
          value: summarize(t, subs, modes),
        }),
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
  const cfg = await bot.guildConfig.get(guildId);
  const subs = cfg.sportsSubscriptions ?? [];
  const modes = cfg.sportsSubscriptionModes ?? {};

  if (step === "sport") {
    await interaction.update(leagueStep(ctx.t, value as Sport, subs));
    return;
  }

  if (step === "leagues") {
    if (!interaction.isStringSelectMenu()) return;
    const sport = value as Sport;
    const keepOtherSports = subs.filter((key) => SPORTS_CATALOG[key]?.sport !== sport);
    const next = [...keepOtherSports, ...interaction.values];
    // Drop mode entries for leagues no longer subscribed anywhere.
    const nextModes = Object.fromEntries(
      Object.entries(modes).filter(([key]) => next.includes(key)),
    );
    await bot.guildConfig.update(guildId, {
      sportsSubscriptions: next,
      sportsSubscriptionModes: nextModes,
    });
    // With leagues picked, choose their announcement mode; nothing subscribed
    // for this sport → straight back to the sport list.
    await interaction.update(
      interaction.values.length > 0
        ? modeStep(ctx.t, sport, next, nextModes)
        : sportStep(ctx.t, next, nextModes),
    );
    // Populate /events right away instead of waiting for the next scheduled
    // import tick (up to 15 min). Fire-and-forget so the UI stays responsive.
    void bot.sportsImporter?.run([guildId]).catch((err) => {
      bot.logger.error({ err, guildId }, "Immediate sports import after subscribe failed");
    });
    return;
  }

  if (step === "modes") {
    if (!interaction.isStringSelectMenu()) return;
    const sport = value as Sport;
    const announceAll = new Set(interaction.values);
    const nextModes: typeof modes = { ...modes };
    const flippedToFollow: string[] = [];
    for (const key of subs) {
      if (SPORTS_CATALOG[key]?.sport !== sport) continue;
      if (announceAll.has(key)) {
        delete nextModes[key]; // "all" is the default — keep config lean
      } else {
        if (modeOf(modes, key) === "all") flippedToFollow.push(key);
        nextModes[key] = "follow";
      }
    }
    await bot.guildConfig.update(guildId, { sportsSubscriptionModes: nextModes });
    // Fixtures already imported under "all" (including the immediate import
    // right after the league step) were digest-marked silently — re-list them
    // so the follow list actually gets posted.
    for (const key of flippedToFollow) {
      await bot.events?.relistUpcoming(guildId, key).catch((err) => {
        bot.logger.error({ err, guildId, key }, "Failed to re-list fixtures after mode change");
      });
    }
    await interaction.update(sportStep(ctx.t, subs, nextModes));
    return;
  }

  if (step === "back") {
    await interaction.update(sportStep(ctx.t, subs, modes));
    return;
  }

  if (step === "done") {
    await interaction.update(doneStep(ctx.t, subs, modes));
  }
}
