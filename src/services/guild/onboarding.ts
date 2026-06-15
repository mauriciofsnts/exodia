import {
  ChannelType,
  EmbedBuilder,
  type Guild,
  PermissionFlagsBits,
  type SendableChannels,
  type TextChannel,
} from "discord.js";
import type { BotContext } from "@/core/context.js";

export const CONFIG_CHANNEL_NAME = "exodia-config";
const EMBED_COLOR = 0x5865f2;

// Runs when the bot joins a guild: set up a config channel and post the setup
// guide. If the channel can't be created (missing Manage Channels), fall back to
// any channel we can talk in and tell an admin to run `config resume`.
export async function onboardGuild(guild: Guild, ctx: BotContext): Promise<void> {
  const prefix = await ctx.guildConfig.resolvePrefix(guild.id);
  const channel = await ensureConfigChannel(guild).catch(() => null);

  if (channel) {
    await postGuide(channel, ctx, guild, prefix);
    await ctx.guildConfig.update(guild.id, { configured: true });
    return;
  }

  const fallback = fallbackChannel(guild);
  if (fallback) {
    const t = ctx.i18n.bind(ctx.i18n.resolveLocale(guild.preferredLocale));
    await fallback.send(t("onboarding.cantCreateChannel", { prefix })).catch(() => {});
  } else {
    ctx.logger.warn({ guildId: guild.id }, "Joined guild with nowhere to post onboarding");
  }
}

// Used by `config resume`: ensure the config channel (create or reuse) and post
// the guide there; if that's impossible, post in `here` (where resume was run).
// Returns the dedicated channel when one exists, else null.
export async function resumeOnboarding(
  guild: Guild,
  ctx: BotContext,
  here: SendableChannels,
): Promise<TextChannel | null> {
  const prefix = await ctx.guildConfig.resolvePrefix(guild.id);
  const channel = await ensureConfigChannel(guild).catch(() => null);

  await postGuide(channel ?? here, ctx, guild, prefix);
  await ctx.guildConfig.update(guild.id, { configured: true });
  return channel;
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

async function postGuide(
  channel: SendableChannels,
  ctx: BotContext,
  guild: Guild,
  prefix: string,
): Promise<void> {
  const t = ctx.i18n.bind(ctx.i18n.resolveLocale(guild.preferredLocale));
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(t("onboarding.welcome", { guild: guild.name }))
    .setDescription(t("onboarding.guide", { prefix }));
  await channel.send({ embeds: [embed] });
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
