import type { Match, MatchList, MatchProvider } from "./types.js";

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
}

interface SdbResponse {
  events: SdbEvent[] | null;
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

  private async fetchEvents(endpoint: string, leagueId: string): Promise<SdbEvent[]> {
    const url = `https://www.thesportsdb.com/api/v1/json/${this.apiKey}/${endpoint}.php?id=${leagueId}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`TheSportsDB returned ${res.status}`);

    const data = (await res.json()) as SdbResponse;
    return data.events ?? [];
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
  };
}

function formatWhen(event: SdbEvent): string {
  if (event.strTimestamp) return event.strTimestamp.replace("T", " ").slice(0, 16);
  return [event.dateEvent, event.strTime?.slice(0, 5)].filter(Boolean).join(" ");
}

// TheSportsDB reports times in UTC — strTimestamp is already a full ISO
// instant; otherwise combine the date + time fields as UTC.
function parseWhen(event: SdbEvent): Date | null {
  const iso = event.strTimestamp
    ? event.strTimestamp
    : event.dateEvent && event.strTime
      ? `${event.dateEvent}T${event.strTime}Z`
      : null;
  if (!iso) return null;

  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}
