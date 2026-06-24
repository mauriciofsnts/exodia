import { GoogleNewsProvider } from "./googleNewsProvider";
import { HackerNewsProvider } from "./hackerNewsProvider";
import { TabNewsProvider } from "./tabnewsProvider";
import type { NewsProvider } from "./types";

// One provider per category. Mix sources freely: dev comes from Hacker News,
// the rest from Google News. Register a new category by adding a provider here.
const providers: NewsProvider[] = [
  new HackerNewsProvider(), // dev
  new TabNewsProvider(), // tabnews
  new GoogleNewsProvider("world", "mundo"),
  new GoogleNewsProvider("football", "futebol"),
  new GoogleNewsProvider("sports", "esportes"),
];

export const newsProviders = new Map(providers.map((provider) => [provider.category, provider]));
export const NEWS_CATEGORIES = providers.map((provider) => provider.category);
