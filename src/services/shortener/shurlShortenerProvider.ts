import type { ShortenerProvider, ShortenOptions } from "./types";

// Default link lifetime (seconds) — ~2 months, matching the Go reference impl.
const DEFAULT_TTL = 5_259_600;

// Shurl's response shape — only `url` is consumed, the rest is documented for clarity.
// https://github.com/pauloo27/shurl
interface ShurlResponse {
  slug: string;
  domain: string;
  url: string;
  original_url: string;
  ttl: number;
}

// JSON/POST shortener backed by a Shurl server (https://github.com/pauloo27/shurl).
// Authenticates with an API key and supports a custom slug and per-link TTL.
export class ShurlShortenerProvider implements ShortenerProvider {
  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
  ) {}

  async shorten(longUrl: string, opts?: ShortenOptions): Promise<string> {
    const payload: Record<string, unknown> = {
      original_url: longUrl,
      ttl: opts?.keepAliveFor ?? DEFAULT_TTL,
    };
    if (opts?.slug) payload.slug = opts.slug;

    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": this.apiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });

    // Shurl returns 201 Created on success; surface the body on anything else.
    if (res.status !== 201) {
      throw new Error(`Shurl returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    const { url } = (await res.json()) as ShurlResponse;
    if (!url) throw new Error("Shurl response missing url");
    return url;
  }
}
