import type { Redis } from "ioredis";
import { cached } from "@/infra/cache/cached";
import type { Logger } from "@/lib/logger";
import type { EventDetails, EventRepository } from "@/services/events/eventRepository";
import type { GuildConfigService } from "@/services/guild/guildConfig";
import { SPORTS_CATALOG } from "./catalog";
import type { Match, MatchProvider } from "./provider/types";

const FIXTURES_PER_LEAGUE = 20; // headroom over the /matches display limit
const FETCH_CACHE_TTL = 1800; // 30 min — how often each league is actually fetched
// TV data changes rarely and the reminder + start announcement land ~15 min
// apart — one fetch covers both.
const TV_CACHE_TTL = 3 * 3600;

// Fetches upcoming fixtures for every league guilds subscribed to (via
// `/sportsub`) and inserts them as guild_events, deduped by provider event id.
// The existing EventScheduler then mirrors them to Discord and announces them
// exactly like manually-added events — no separate notification path needed.
export class SportsImporter {
  constructor(
    private readonly guildConfig: GuildConfigService,
    private readonly events: EventRepository,
    private readonly theSportsDb: MatchProvider,
    // Preferred source for football leagues that have a footballDataCode —
    // null when FOOTBALL_DATA_API_KEY isn't configured, falling back to
    // theSportsDb for every sport as before.
    private readonly footballData: MatchProvider | null,
    private readonly cache: Redis,
    private readonly logger: Logger,
  ) {}

  async run(guildIds: Iterable<string>): Promise<void> {
    const subsByGuild = new Map<string, string[]>();
    for (const guildId of guildIds) {
      const subs = (await this.guildConfig.get(guildId)).sportsSubscriptions;
      if (subs?.length) subsByGuild.set(guildId, subs);
    }
    if (subsByGuild.size === 0) return;

    const neededKeys = new Set<string>();
    for (const subs of subsByGuild.values()) {
      for (const key of subs) neededKeys.add(key);
    }

    const fixturesByKey = new Map<string, Match[]>();
    for (const key of neededKeys) {
      const fixtures = await this.fetchUpcoming(key);
      if (fixtures) fixturesByKey.set(key, fixtures);
    }

    for (const [guildId, subs] of subsByGuild) {
      for (const key of subs) {
        for (const fixture of fixturesByKey.get(key) ?? []) {
          await this.importFixture(guildId, key, fixture);
        }
      }
    }
  }

  // Manual re-fetch of this guild's football subscriptions, bypassing the
  // 30-min fetch cache — backs the `!importfootball` admin command so a fresh
  // fixture list shows up immediately instead of waiting for the next
  // scheduled import (or the cache to expire).
  async forceFootballImport(guildId: string): Promise<{ leagues: number; fixtures: number }> {
    const subs = ((await this.guildConfig.get(guildId)).sportsSubscriptions ?? []).filter(
      (key) => SPORTS_CATALOG[key]?.sport === "football",
    );
    if (subs.length === 0) return { leagues: 0, fixtures: 0 };

    await Promise.all(
      subs.map((key) => this.cache.del(`cache:sportsimport:${key}`).catch(() => {})),
    );

    let fixtures = 0;
    for (const key of subs) {
      const matches = await this.fetchUpcoming(key);
      if (!matches) continue;
      fixtures += matches.length;
      for (const fixture of matches) {
        await this.importFixture(guildId, key, fixture);
      }
    }
    return { leagues: subs.length, fixtures };
  }

  // "Where to watch" channels for one fixture, by the provider's event id.
  // Best-effort: cached, and any failure degrades to "no channels" — a TV
  // lookup problem must never block an announcement. `source` (the catalog
  // key) is needed to tell whether this fixture actually came from
  // TheSportsDB — football-data.org has no TV data, and its event ids share
  // no namespace with TheSportsDB's, so a football-data fixture must never be
  // looked up there.
  async whereToWatch(source: string | null, externalId: string): Promise<string[]> {
    if (source && this.usesFootballData(source)) return [];

    const tvChannels = this.theSportsDb.tvChannels?.bind(this.theSportsDb);
    if (!tvChannels) return [];

    try {
      return await cached(this.cache, `cache:sportstv:${externalId}`, TV_CACHE_TTL, () =>
        tvChannels(externalId),
      );
    } catch (err) {
      this.logger.warn({ err, externalId }, "Failed to fetch TV channels for fixture");
      return [];
    }
  }

  private usesFootballData(catalogKey: string): boolean {
    return !!this.footballData && !!SPORTS_CATALOG[catalogKey]?.footballDataCode;
  }

  private async fetchUpcoming(catalogKey: string): Promise<Match[] | null> {
    const league = SPORTS_CATALOG[catalogKey];
    if (!league) return null;

    const [provider, leagueRef] =
      this.footballData && league.footballDataCode
        ? [this.footballData, league.footballDataCode]
        : [this.theSportsDb, league.id];

    try {
      const { matches } = await cached(
        this.cache,
        `cache:sportsimport:${catalogKey}`,
        FETCH_CACHE_TTL,
        () => provider.matches(leagueRef, FIXTURES_PER_LEAGUE),
      );
      return matches;
    } catch (err) {
      this.logger.error({ err, catalogKey }, "Failed to fetch fixtures for sports import");
      return null;
    }
  }

  private async importFixture(guildId: string, catalogKey: string, fixture: Match): Promise<void> {
    // Cached fixtures round-trip through JSON, so Date fields arrive as
    // strings on a cache hit — re-wrap before comparing/persisting.
    const startAt = fixture.startsAtDate ? new Date(fixture.startsAtDate) : null;
    if (!startAt || startAt.getTime() <= Date.now()) return;

    const details: EventDetails = {
      home: fixture.home,
      away: fixture.away,
      competition: fixture.competition || undefined,
      venue: fixture.venue,
      homeBadge: fixture.homeBadge,
      awayBadge: fixture.awayBadge,
      leagueBadge: fixture.leagueBadge,
      thumb: fixture.thumb,
    };

    await this.events
      .createIfNew(
        guildId,
        `${fixture.home} vs ${fixture.away}`,
        startAt,
        catalogKey,
        fixture.id,
        details,
      )
      .catch((err) => {
        this.logger.error(
          { err, guildId, catalogKey, fixtureId: fixture.id },
          "Failed to import fixture",
        );
      });
  }
}
