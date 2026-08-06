// Championship key → TheSportsDB league id + display label. `footballDataCode`
// is the matching football-data.org competition code (only their 8 free-tier
// competitions have one) — used instead of TheSportsDB when FOOTBALL_DATA_API_KEY
// is configured, since TheSportsDB's free test key caps upcoming fixtures at 1
// per league while football-data.org's free tier returns the full schedule.
export const LEAGUES: Record<string, { id: string; label: string; footballDataCode?: string }> = {
  premier: { id: "4328", label: "Premier League", footballDataCode: "PL" },
  laliga: { id: "4335", label: "La Liga", footballDataCode: "PD" },
  seriea: { id: "4332", label: "Serie A", footballDataCode: "SA" },
  bundesliga: { id: "4331", label: "Bundesliga", footballDataCode: "BL1" },
  ligue1: { id: "4334", label: "Ligue 1", footballDataCode: "FL1" },
  brasileirao: { id: "4351", label: "Brasileirão Série A", footballDataCode: "BSA" },
  champions: { id: "4480", label: "UEFA Champions League", footballDataCode: "CL" },
  worldcup: { id: "4429", label: "FIFA World Cup", footballDataCode: "WC" },
};
