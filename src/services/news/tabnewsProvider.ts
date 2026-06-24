import type { NewsItem, NewsProvider } from "./types";

interface TabNewsContent {
  slug: string;
  title: string | null;
  owner_username: string;
}

// Brazilian dev/tech community news from TabNews' public API (no key required).
// Defaults to the "relevant" front page; one instance per category.
export class TabNewsProvider implements NewsProvider {
  constructor(
    readonly category = "tabnews",
    private readonly strategy: "relevant" | "new" = "relevant",
  ) {}

  async fetchHeadlines(limit: number): Promise<NewsItem[]> {
    const url =
      `https://www.tabnews.com.br/api/v1/contents?strategy=${this.strategy}` +
      `&page=1&per_page=${Math.max(limit, 1)}`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`TabNews returned ${res.status}`);

    const data = (await res.json()) as TabNewsContent[];
    return data
      .filter((content) => content.title)
      .slice(0, limit)
      .map((content) => ({
        title: content.title as string,
        url: `https://www.tabnews.com.br/${content.owner_username}/${content.slug}`,
        source: "TabNews",
      }));
  }
}
