import {
  ChannelType,
  type Guild,
  PermissionFlagsBits,
  type SendableChannels,
  type TextChannel,
} from "discord.js";
import type { BotContext } from "@/core/context";
import { languageStep } from "@/services/guild/onboardingWizard";

export const CONFIG_CHANNEL_NAME = "exodia-config";

// Runs when the bot joins a guild: set up a config channel and post the setup
// wizard. If the channel can't be created (missing Manage Channels), fall back
// to any channel we can talk in and tell an admin to run `/setup`.
export async function onboardGuild(guild: Guild, ctx: BotContext): Promise<void> {
  const channel = await ensureConfigChannel(guild).catch(() => null);

  if (channel) {
    await postGuide(channel, ctx, guild);
    return;
  }

  const fallback = fallbackChannel(guild);
  if (fallback) {
    const t = ctx.i18n.bind(ctx.i18n.resolveLocale(guild.preferredLocale));
    await fallback.send(t("onboarding.cantCreateChannel")).catch(() => {});
  } else {
    ctx.logger.warn({ guildId: guild.id }, "Joined guild with nowhere to post onboarding");
  }
}

async function ensureConfigChannel(guild: Guild): Promise<TextChannel> {
  // Reuse a channel the admin may have created by hand before running resume.
  const existing = guild.channels.cache.find(
    (c): c is TextChannel => c.type === ChannelType.GuildText && c.name === CONFIG_CHANNEL_NAME,
  );
  if (existing) return existing;

  return guild.channels.create({
    name: CONFIG_CHANNEL_NAME,
    type: ChannelType.GuildText,
    topic: "Configure the bot here.",
  });
}

async function postGuide(channel: SendableChannels, ctx: BotContext, guild: Guild): Promise<void> {
  const t = ctx.i18n.bind(ctx.i18n.resolveLocale(guild.preferredLocale));
  await channel.send({
    content: t("onboarding.welcome", { guild: guild.name }),
    ...languageStep(t),
  });
}

function fallbackChannel(guild: Guild): SendableChannels | null {
  const me = guild.members.me;
  if (!me) return null;

  const canSend = (c: TextChannel): boolean =>
    c.viewable && (c.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages) ?? false);

  if (guild.systemChannel && canSend(guild.systemChannel)) return guild.systemChannel;

  return (
    guild.channels.cache.find(
      (c): c is TextChannel => c.type === ChannelType.GuildText && canSend(c),
    ) ?? null
  );
}
