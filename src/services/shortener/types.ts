// Per-request options. Honored by providers that support them (e.g. Shurl);
// ignored by simple GET-based providers.
export interface ShortenOptions {
  // Lifetime of the short link in seconds. Provider applies its own default when omitted.
  keepAliveFor?: number;
  // Custom slug to request instead of an auto-generated one.
  slug?: string;
}

// Implement this to back the /shorten command with any shortener.
export interface ShortenerProvider {
  shorten(longUrl: string, opts?: ShortenOptions): Promise<string>;
}
