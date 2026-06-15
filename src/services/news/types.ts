export interface NewsItem {
  title: string;
  url: string;
  source?: string;
}

// One provider per news category. Implement this and register it in index.ts to
// add a category (or swap the source of an existing one).
export interface NewsProvider {
  readonly category: string;
  fetchHeadlines(limit: number): Promise<NewsItem[]>;
}
