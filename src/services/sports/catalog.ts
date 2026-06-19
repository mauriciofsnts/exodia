import { LEAGUES as BASKETBALL_LEAGUES } from "./leagues/basketball";
import { LEAGUES as F1_LEAGUES } from "./leagues/f1";
import { LEAGUES as FOOTBALL_LEAGUES } from "./leagues/football";

export type Sport = "football" | "basketball" | "f1";

export interface SportLeague {
  sport: Sport;
  id: string; // TheSportsDB league id
  label: string;
}

const BY_SPORT: Record<Sport, Record<string, { id: string; label: string }>> = {
  football: FOOTBALL_LEAGUES,
  basketball: BASKETBALL_LEAGUES,
  f1: F1_LEAGUES,
};

// Unified catalog of every subscribable league across all sports, keyed as
// "<sport>:<leagueKey>" (e.g. "football:premier", "basketball:nba"). Backs the
// `/sportsub` autocomplete and the auto-import scheduler.
export const SPORTS_CATALOG: Record<string, SportLeague> = Object.fromEntries(
  Object.entries(BY_SPORT).flatMap(([sport, leagues]) =>
    Object.entries(leagues).map(([key, league]) => [
      `${sport}:${key}`,
      { sport: sport as Sport, id: league.id, label: league.label },
    ]),
  ),
);
