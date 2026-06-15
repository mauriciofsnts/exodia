import { GoogleNewsProvider } from "./googleNewsProvider.js";
import { HackerNewsProvider } from "./hackerNewsProvider.js";
import type { NewsProvider } from "./types.js";

// One provider per category. Mix sources freely: dev comes from Hacker News,
// the rest from Google News. Register a new category by adding a provider here.
const providers: NewsProvider[] = [
  new HackerNewsProvider(), // dev
  new GoogleNewsProvider("world", "mundo"),
  new GoogleNewsProvider("football", "futebol"),
  new GoogleNewsProvider("sports", "esportes"),
];

export const newsProviders = new Map(providers.map((provider) => [provider.category, provider]));
export const NEWS_CATEGORIES = providers.map((provider) => provider.category);
