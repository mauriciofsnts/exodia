// Which storefront a freebie belongs to — drives the per-guild store filter.
export type FreeGameStore = "epic" | "steam" | "gog" | "other";

// A normalized "free right now" offer, provider-agnostic.
export interface FreeGame {
  provider: string; // "epic" | "gamerpower" — dedup namespace with externalId
  externalId: string; // provider's stable id for this offer
  store: FreeGameStore;
  title: string;
  url: string;
  originalPrice?: string; // formatted, e.g. "$29.99" — unknown for some giveaways
  endsAt?: Date; // undefined when the giveaway has no known end
  imageUrl?: string;
  description?: string;
}

export interface FreeGameProvider {
  readonly name: string;
  // Only offers that are active and fully free right now — never upcoming ones.
  fetchFreeGames(): Promise<FreeGame[]>;
}
