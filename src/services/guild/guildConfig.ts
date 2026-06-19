import type { Redis } from "ioredis";
import type { Locale } from "@/i18n/index.js";

// How a guild wants to be notified when a guild_events row starts:
// "embed" posts a rich embed in `eventsChannelId`; "discord" creates a native
// Discord scheduled event instead and skips the channel message entirely.
export type EventsMode = "embed" | "discord";

export interface GuildConfig {
  prefix?: string;
  locale?: Locale;
  configured?: boolean; // onboarding completed (config channel set up)
  eventsEnabled?: boolean; // auto-create Discord scheduled events from guild_events
  eventsMode?: EventsMode; // defaults to "discord" when unset (legacy behavior)
  eventsChannelId?: string; // where to post the embed when eventsMode is "embed"
  eventsMentionEveryone?: boolean; // prefix the embed announcement with @everyone
  sportsSubscriptions?: string[]; // SPORTS_CATALOG keys (e.g. "football:premier") to auto-import as events
}

const configKey = (guildId: string) => `guild:${guildId}:config`;

// Per-guild settings backed by Redis, with an in-memory cache so the prefix can
// be resolved on the messageCreate hot path without a round trip every message.
export class GuildConfigService {
  private cache = new Map<string, GuildConfig>();

  constructor(
    private readonly redis: Redis,
    private readonly defaultPrefix: string,
  ) {}

  async get(guildId: string): Promise<GuildConfig> {
    const cached = this.cache.get(guildId);
    if (cached) return cached;

    const raw = await this.redis.get(configKey(guildId));
    const parsed = raw ? (safeParse(raw) ?? {}) : {};
    this.cache.set(guildId, parsed);
    return parsed;
  }

  async update(guildId: string, patch: Partial<GuildConfig>): Promise<GuildConfig> {
    const next = { ...(await this.get(guildId)), ...patch };
    this.cache.set(guildId, next);
    await this.redis.set(configKey(guildId), JSON.stringify(next));
    return next;
  }

  // Falls back to the global default for DMs and unconfigured guilds.
  async resolvePrefix(guildId: string | null): Promise<string> {
    if (!guildId) return this.defaultPrefix;
    return (await this.get(guildId)).prefix ?? this.defaultPrefix;
  }

  // Returns the explicitly configured locale, or undefined to let the caller
  // fall back (e.g. to Discord's locale).
  async resolveLocale(guildId: string | null): Promise<Locale | undefined> {
    if (!guildId) return undefined;
    return (await this.get(guildId)).locale;
  }
}

function safeParse(raw: string): GuildConfig | null {
  try {
    return JSON.parse(raw) as GuildConfig;
  } catch {
    return null;
  }
}
