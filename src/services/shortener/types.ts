// Implement this to back the /shorten command with any shortener.
export interface ShortenerProvider {
  shorten(longUrl: string): Promise<string>;
}
