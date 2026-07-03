import type { Match, MatchList, MatchProvider } from "./types";

interface SdbEvent {
  idEvent: string;
  strHomeTeam: string | null;
  strAwayTeam: string | null;
  strTimestamp: string | null;
  dateEvent: string | null;
  strTime: string | null;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strLeague: string | null;
  strLeagueBadge: string | null;
  strHomeTeamBadge: string | null;
  strAwayTeamBadge: string | null;
  strVenue: string | null;
  strThumb: string | null;
  strSquare: string | null;
  strPoster: string | null;
}

interface SdbResponse {
  events: SdbEvent[] | null;
}

interface SdbTvEvent {
  strChannel: string | null;
}

interface SdbTvResponse {
  tvevent: SdbTvEvent[] | null;
}

// Fixtures from TheSportsDB. The public test key "3" only returns past events,
// so we fall back to recent results when there are no upcoming ones; a real
// SPORTSDB_API_KEY returns the upcoming fixtures.
export class TheSportsDbProvider implements MatchProvider {
  constructor(private readonly apiKey: string = "3") {}

  async matches(leagueId: string, limit: number): Promise<MatchList> {
    const upcoming = await this.fetchEvents("eventsnextleague", leagueId);
    if (upcoming.length > 0) {
      return { kind: "upcoming", matches: upcoming.slice(0, limit).map(toMatch) };
    }

    const recent = await this.fetchEvents("eventspastleague", leagueId);
    return { kind: "recent", matches: recent.slice(0, limit).map(toMatch) };
  }

  // Broadcast channels for one event. TheSportsDB fills these in closer to the
  // start time (and not for every event/region), so an empty list is common.
  async tvChannels(eventId: string): Promise<string[]> {
    const data = (await this.fetchJson(`lookuptv.php?id=${eventId}`)) as SdbTvResponse;
    const channels = new Set<string>();
    for (const tv of data.tvevent ?? []) {
      if (tv.strChannel) channels.add(tv.strChannel);
    }
    return [...channels];
  }

  private async fetchEvents(endpoint: string, leagueId: string): Promise<SdbEvent[]> {
    const data = (await this.fetchJson(`${endpoint}.php?id=${leagueId}`)) as SdbResponse;
    return data.events ?? [];
  }

  private async fetchJson(path: string): Promise<unknown> {
    const url = `https://www.thesportsdb.com/api/v1/json/${this.apiKey}/${path}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`TheSportsDB returned ${res.status}`);
    return res.json();
  }
}

function toMatch(event: SdbEvent): Match {
  const hasScore = event.intHomeScore !== null && event.intAwayScore !== null;
  return {
    id: event.idEvent,
    home: event.strHomeTeam ?? "?",
    away: event.strAwayTeam ?? "?",
    startsAt: formatWhen(event),
    startsAtDate: parseWhen(event),
    score: hasScore ? `${event.intHomeScore}-${event.intAwayScore}` : undefined,
    competition: event.strLeague ?? "",
    venue: clean(event.strVenue),
    homeBadge: clean(event.strHomeTeamBadge),
    awayBadge: clean(event.strAwayTeamBadge),
    leagueBadge: clean(event.strLeagueBadge),
    // The dedicated event banner is usually empty for upcoming fixtures —
    // square/poster art are the next best thing when present.
    thumb: clean(event.strThumb) ?? clean(event.strSquare) ?? clean(event.strPoster),
  };
}

// TheSportsDB uses "" (not null) for many absent fields — normalise to undefined.
function clean(value: string | null): string | undefined {
  return value ? value : undefined;
}

function formatWhen(event: SdbEvent): string {
  if (event.strTimestamp) return event.strTimestamp.replace("T", " ").slice(0, 16);
  return [event.dateEvent, event.strTime?.slice(0, 5)].filter(Boolean).join(" ");
}

// TheSportsDB reports times in UTC, but strTimestamp comes without a "Z"
// (e.g. "2026-07-02T23:00:00"), so new Date() would parse it in server-local
// time — pin it to UTC. The date + time fallback is combined as UTC too.
function parseWhen(event: SdbEvent): Date | null {
  const iso = event.strTimestamp
    ? event.strTimestamp.endsWith("Z")
      ? event.strTimestamp
      : `${event.strTimestamp}Z`
    : event.dateEvent && event.strTime
      ? `${event.dateEvent}T${event.strTime}Z`
      : null;
  if (!iso) return null;

  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}
