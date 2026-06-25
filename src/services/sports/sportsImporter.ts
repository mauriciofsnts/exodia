import type { Redis } from "ioredis";
import { cached } from "@/infra/cache/cached";
import type { Logger } from "@/lib/logger";
import type { EventRepository } from "@/services/events/eventRepository";
import type { GuildConfigService } from "@/services/guild/guildConfig";
import { SPORTS_CATALOG } from "./catalog";
import type { Match, MatchProvider } from "./provider/types";

const FIXTURES_PER_LEAGUE = 20; // headroom over the /matches display limit
const FETCH_CACHE_TTL = 1800; // 30 min — how often each league is actually fetched

// Fetches upcoming fixtures for every league guilds subscribed to (via
// `/sportsub`) and inserts them as guild_events, deduped by provider event id.
// The existing EventScheduler then mirrors them to Discord and announces them
// exactly like manually-added events — no separate notification path needed.
export class SportsImporter {
  constructor(
    private readonly guildConfig: GuildConfigService,
    private readonly events: EventRepository,
    private readonly provider: MatchProvider,
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

  private async fetchUpcoming(catalogKey: string): Promise<Match[] | null> {
    const league = SPORTS_CATALOG[catalogKey];
    if (!league) return null;

    try {
      const { matches } = await cached(
        this.cache,
        `cache:sportsimport:${catalogKey}`,
        FETCH_CACHE_TTL,
        () => this.provider.matches(league.id, FIXTURES_PER_LEAGUE),
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

    await this.events
      .createIfNew(guildId, `${fixture.home} vs ${fixture.away}`, startAt, catalogKey, fixture.id)
      .catch((err) => {
        this.logger.error(
          { err, guildId, catalogKey, fixtureId: fixture.id },
          "Failed to import fixture",
        );
      });
  }
}
