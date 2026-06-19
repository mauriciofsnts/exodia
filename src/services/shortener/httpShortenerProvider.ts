import type { ShortenerProvider } from "./types";

// TinyURL returns the short link as plain text and needs no key.
const DEFAULT_ENDPOINT = "https://tinyurl.com/api-create.php?url={url}";

// Generic GET-based shortener: point `endpoint` at any service, using `{url}` as
// the placeholder for the (encoded) long URL. Override `parse` if the service
// returns JSON instead of a plain-text link.
export class HttpShortenerProvider implements ShortenerProvider {
  constructor(
    private readonly endpoint: string = DEFAULT_ENDPOINT,
    private readonly parse: (body: string) => string = (body) => body.trim(),
  ) {}

  async shorten(longUrl: string): Promise<string> {
    const requestUrl = this.endpoint.replace("{url}", encodeURIComponent(longUrl));
    const res = await fetch(requestUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Shortener returned ${res.status}`);

    const short = this.parse(await res.text());
    if (!/^https?:\/\//i.test(short)) {
      throw new Error(`Unexpected shortener response: ${short.slice(0, 80)}`);
    }
    return short;
  }
}
