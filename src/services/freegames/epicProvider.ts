import type { FreeGame, FreeGameProvider } from "./types";

const API_URL =
  "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US";
const STORE_URL = "https://store.epicgames.com";

interface EpicKeyImage {
  type?: string;
  url?: string;
}

interface EpicPromotionalOffer {
  startDate?: string;
  endDate?: string;
  discountSetting?: { discountPercentage?: number };
}

interface EpicElement {
  id?: string;
  title?: string;
  description?: string;
  productSlug?: string;
  urlSlug?: string;
  offerMappings?: Array<{ pageSlug?: string }>;
  catalogNs?: { mappings?: Array<{ pageSlug?: string }> };
  keyImages?: EpicKeyImage[];
  price?: {
    totalPrice?: { discountPrice?: number; fmtPrice?: { originalPrice?: string } };
  };
  promotions?: {
    promotionalOffers?: Array<{ promotionalOffers?: EpicPromotionalOffer[] }>;
    upcomingPromotionalOffers?: unknown;
  } | null;
}

interface EpicResponse {
  data?: { Catalog?: { searchStore?: { elements?: EpicElement[] } } };
}

// The active 100%-off window, if any. Epic's response also lists upcoming
// promotions (upcomingPromotionalOffers) and partial discounts — both must be
// ignored, so only a currently-running free window counts.
function activeFreeWindow(element: EpicElement): EpicPromotionalOffer | null {
  const now = Date.now();
  for (const group of element.promotions?.promotionalOffers ?? []) {
    for (const offer of group.promotionalOffers ?? []) {
      if (offer.discountSetting?.discountPercentage !== 0) continue;
      if (!offer.startDate || !offer.endDate) continue;
      const start = Date.parse(offer.startDate);
      const end = Date.parse(offer.endDate);
      if (Number.isFinite(start) && Number.isFinite(end) && start <= now && now < end) {
        return offer;
      }
    }
  }
  return null;
}

function pageUrl(element: EpicElement): string {
  const slug =
    element.offerMappings?.[0]?.pageSlug ??
    element.catalogNs?.mappings?.[0]?.pageSlug ??
    element.productSlug ??
    element.urlSlug;
  return slug ? `${STORE_URL}/p/${slug}` : `${STORE_URL}/free-games`;
}

function imageUrl(element: EpicElement): string | undefined {
  const images = element.keyImages ?? [];
  for (const type of ["OfferImageWide", "OfferImageTall", "Thumbnail"]) {
    const match = images.find((img) => img.type === type && img.url);
    if (match) return match.url;
  }
  return undefined;
}

// Epic Games Store weekly freebies, straight from the official promotions API
// (no key required).
export class EpicProvider implements FreeGameProvider {
  readonly name = "epic";

  async fetchFreeGames(): Promise<FreeGame[]> {
    const res = await fetch(API_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Epic freeGamesPromotions returned ${res.status}`);

    const data = (await res.json()) as EpicResponse;
    const elements = data.data?.Catalog?.searchStore?.elements ?? [];

    const games: FreeGame[] = [];
    for (const element of elements) {
      if (!element.id || !element.title) continue;
      const window = activeFreeWindow(element);
      if (!window) continue;
      // The promotion says 100% off; make sure the effective price agrees.
      if (element.price?.totalPrice?.discountPrice !== 0) continue;

      const endsAt = window.endDate ? new Date(window.endDate) : undefined;
      games.push({
        provider: this.name,
        externalId: element.id,
        store: "epic",
        title: element.title,
        url: pageUrl(element),
        originalPrice: element.price?.totalPrice?.fmtPrice?.originalPrice,
        endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : undefined,
        imageUrl: imageUrl(element),
        description: element.description,
      });
    }
    return games;
  }
}
