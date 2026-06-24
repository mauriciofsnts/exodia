import type { Config } from "@/config/index";
import { HttpShortenerProvider } from "./httpShortenerProvider";
import { ShurlShortenerProvider } from "./shurlShortenerProvider";
import type { ShortenerProvider } from "./types";

// Selects the shortener backend from config:
//   - SHORTENER_API_KEY set → Shurl (JSON/POST, supports slug + TTL) at SHORTENER_ENDPOINT.
//   - otherwise → generic GET-based shortener (SHORTENER_ENDPOINT as a `{url}` template,
//     defaults to TinyURL).
// For another JSON shortener, implement ShortenerProvider and return it here.
export function createShortener(config: Config): ShortenerProvider {
  if (config.SHORTENER_API_KEY) {
    if (!config.SHORTENER_ENDPOINT) {
      throw new Error("SHORTENER_API_KEY is set but SHORTENER_ENDPOINT is missing");
    }
    return new ShurlShortenerProvider(config.SHORTENER_ENDPOINT, config.SHORTENER_API_KEY);
  }
  return new HttpShortenerProvider(config.SHORTENER_ENDPOINT);
}
