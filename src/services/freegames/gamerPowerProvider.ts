import type { FreeGame, FreeGameProvider, FreeGameStore } from "./types";

// `type=game` keeps it to full games — no DLC, loot or beta keys.
const API_URL = "https://www.gamerpower.com/api/giveaways?type=game";

interface GamerPowerGiveaway {
  id?: number;
  title?: string;
  worth?: string;
  thumbnail?: string;
  image?: string;
  description?: string;
  open_giveaway_url?: string;
  gamerpower_url?: string;
  platforms?: string;
  end_date?: string;
  status?: string;
}

function storeOf(platforms: string): FreeGameStore {
  if (platforms.includes("Steam")) return "steam";
  if (platforms.includes("GOG")) return "gog";
  return "other";
}

// GamerPower dates are "YYYY-MM-DD HH:mm:ss" in UTC, or "N/A".
function parseEndDate(raw: string | undefined): Date | undefined {
  if (!raw || raw === "N/A") return undefined;
  const parsed = new Date(`${raw.replace(" ", "T")}Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

// Giveaways across Steam/GOG/itch.io/etc. via the GamerPower aggregator
// (free API, no key required).
export class GamerPowerProvider implements FreeGameProvider {
  readonly name = "gamerpower";

  async fetchFreeGames(): Promise<FreeGame[]> {
    const res = await fetch(API_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`GamerPower returned ${res.status}`);

    // No active giveaways comes back as a non-array payload (status 201).
    const data = (await res.json()) as GamerPowerGiveaway[] | unknown;
    if (!Array.isArray(data)) return [];

    const games: FreeGame[] = [];
    for (const item of data as GamerPowerGiveaway[]) {
      if (!item.id || !item.title) continue;
      if (item.status !== "Active") continue;
      // Epic freebies come from the Epic provider, which is authoritative —
      // skipping them here is the cross-provider dedup.
      const platforms = item.platforms ?? "";
      if (platforms.includes("Epic Games Store")) continue;

      const url = item.open_giveaway_url ?? item.gamerpower_url;
      if (!url) continue;

      games.push({
        provider: this.name,
        externalId: String(item.id),
        store: storeOf(platforms),
        title: item.title.replace(/\s*\(.*\)\s*Giveaway$/i, "").replace(/\s*Giveaway$/i, ""),
        url,
        originalPrice: item.worth && item.worth !== "N/A" ? item.worth : undefined,
        endsAt: parseEndDate(item.end_date),
        imageUrl: item.image ?? item.thumbnail,
        description: item.description,
      });
    }
    return games;
  }
}
