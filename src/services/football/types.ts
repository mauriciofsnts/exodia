export interface Match {
  home: string;
  away: string;
  startsAt: string; // "YYYY-MM-DD HH:mm" (UTC, as the source reports it)
  score?: string; // "2-1" for finished matches
  competition: string;
}

export type MatchKind = "upcoming" | "recent";

export interface MatchList {
  kind: MatchKind;
  matches: Match[];
}

// Implement this to back the /matches command with any football data source.
export interface FootballProvider {
  matches(leagueId: string, limit: number): Promise<MatchList>;
}
