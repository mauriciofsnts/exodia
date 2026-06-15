import type { NewsItem, NewsProvider } from "./types.js";

// Headlines from Google News RSS for an arbitrary query (free, no key). One
// instance per category — the query/locale parameterizes the feed.
export class GoogleNewsProvider implements NewsProvider {
  constructor(
    readonly category: string,
    private readonly query: string,
    private readonly locale: "pt-BR" | "en-US" = "pt-BR",
  ) {}

  async fetchHeadlines(limit: number): Promise<NewsItem[]> {
    const [hl, gl, ceid] =
      this.locale === "pt-BR" ? ["pt-BR", "BR", "BR:pt-419"] : ["en-US", "US", "US:en"];
    const url =
      `https://news.google.com/rss/search?q=${encodeURIComponent(this.query)}` +
      `&hl=${hl}&gl=${gl}&ceid=${ceid}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Google News returned ${res.status}`);

    return parseRssItems(await res.text(), limit);
  }
}

function parseRssItems(xml: string, limit: number): NewsItem[] {
  const items: NewsItem[] = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    if (items.length >= limit) break;

    const block = match[1];
    const rawTitle = block.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim();
    if (!rawTitle || !link) continue;

    const title = decodeEntities(rawTitle).trim();
    // Google News titles read "Headline - Source"; split the source off.
    const sep = title.lastIndexOf(" - ");
    if (sep > 0) {
      items.push({ title: title.slice(0, sep), url: link, source: title.slice(sep + 3) });
    } else {
      items.push({ title, url: link });
    }
  }
  return items;
}

function decodeEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}
