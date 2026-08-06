import type { Match, MatchList, MatchProvider } from "./types";

interface FdTeam {
  name: string | null;
  crest: string | null;
}

interface FdMatch {
  id: number;
  utcDate: string;
  status: string;
  venue?: string | null;
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score: { fullTime: { home: number | null; away: number | null } };
  competition?: { name: string | null; emblem: string | null } | null;
}

interface FdResponse {
  matches: FdMatch[] | null;
}

const BASE_URL = "https://api.football-data.org/v4";
const DAY_MS = 24 * 60 * 60_000;
// Wide enough to catch the next round even for competitions with long gaps
// between fixtures (Champions League, World Cup), narrow enough to keep the
// response small.
const WINDOW_DAYS = 90;
const DONE_STATUSES = new Set(["FINISHED", "CANCELLED", "POSTPONED", "SUSPENDED", "AWARDED"]);

// Fixtures from football-data.org — covers the 8 free-tier competitions (see
// leagues/football.ts). Unlike TheSportsDB's free test key, the free tier here
// returns the full upcoming schedule rather than just the next fixture.
export class FootballDataProvider implements MatchProvider {
  constructor(private readonly apiKey: string) {}

  async matches(competitionCode: string, limit: number): Promise<MatchList> {
    const upcoming = await this.fetchWindow(competitionCode, 0, WINDOW_DAYS);
    const scheduled = upcoming
      .filter((m) => !DONE_STATUSES.has(m.status))
      .sort((a, b) => a.utcDate.localeCompare(b.utcDate));
    if (scheduled.length > 0) {
      return { kind: "upcoming", matches: scheduled.slice(0, limit).map(toMatch) };
    }

    // Off-season fallback: most recent finished matches, newest first.
    const past = await this.fetchWindow(competitionCode, -WINDOW_DAYS, 0);
    const finished = past
      .filter((m) => m.status === "FINISHED")
      .sort((a, b) => b.utcDate.localeCompare(a.utcDate));
    return { kind: "recent", matches: finished.slice(0, limit).map(toMatch) };
  }

  // football-data.org's free tier doesn't expose broadcast/TV data.

  private async fetchWindow(
    competitionCode: string,
    fromOffsetDays: number,
    toOffsetDays: number,
  ): Promise<FdMatch[]> {
    const dateFrom = isoDate(new Date(Date.now() + fromOffsetDays * DAY_MS));
    const dateTo = isoDate(new Date(Date.now() + toOffsetDays * DAY_MS));
    const url = `${BASE_URL}/competitions/${competitionCode}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
    const res = await fetch(url, {
      headers: { "X-Auth-Token": this.apiKey },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`football-data.org returned ${res.status}`);
    const data = (await res.json()) as FdResponse;
    return data.matches ?? [];
  }
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toMatch(m: FdMatch): Match {
  const hasScore = m.score.fullTime.home !== null && m.score.fullTime.away !== null;
  const date = new Date(m.utcDate);
  return {
    id: String(m.id),
    home: m.homeTeam.name ?? "?",
    away: m.awayTeam.name ?? "?",
    startsAt: m.utcDate.replace("T", " ").slice(0, 16),
    startsAtDate: Number.isNaN(date.getTime()) ? null : date,
    score: hasScore ? `${m.score.fullTime.home}-${m.score.fullTime.away}` : undefined,
    competition: m.competition?.name ?? "",
    venue: m.venue ?? undefined,
    homeBadge: m.homeTeam.crest ?? undefined,
    awayBadge: m.awayTeam.crest ?? undefined,
    leagueBadge: m.competition?.emblem ?? undefined,
  };
}
