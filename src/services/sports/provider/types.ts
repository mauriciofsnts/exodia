export interface Match {
  id: string; // provider's event id — stable, used to dedup auto-imported fixtures
  home: string;
  away: string;
  startsAt: string; // "YYYY-MM-DD HH:mm" (UTC, as the source reports it), for display
  startsAtDate: Date | null; // parsed start time, for scheduling — null if unparseable
  score?: string; // "2-1" for finished matches
  competition: string;
}

export type MatchKind = "upcoming" | "recent";

export interface MatchList {
  kind: MatchKind;
  matches: Match[];
}

// Implement this to back any sport (football, basketball, F1, ...) with a
// fixtures data source — used by /matches and the sports auto-importer alike.
export interface MatchProvider {
  matches(leagueId: string, limit: number): Promise<MatchList>;
}
