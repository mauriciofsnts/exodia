import type { NewsItem, NewsProvider } from "./types";

interface HnHit {
  title: string | null;
  url: string | null;
  objectID: string;
}

interface HnResponse {
  hits: HnHit[];
}

// Dev news from Hacker News' front page (Algolia API, no key required).
export class HackerNewsProvider implements NewsProvider {
  readonly category = "dev";

  async fetchHeadlines(limit: number): Promise<NewsItem[]> {
    const res = await fetch("https://hn.algolia.com/api/v1/search?tags=front_page", {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Hacker News returned ${res.status}`);

    const data = (await res.json()) as HnResponse;
    return data.hits
      .filter((hit) => hit.title)
      .slice(0, limit)
      .map((hit) => ({
        title: hit.title as string,
        url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
        source: "Hacker News",
      }));
  }
}
