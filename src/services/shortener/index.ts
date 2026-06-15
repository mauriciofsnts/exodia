import type { Config } from "@/config/index.js";
import { HttpShortenerProvider } from "./httpShortenerProvider.js";
import type { ShortenerProvider } from "./types.js";

// Plug any GET-based shortener via SHORTENER_ENDPOINT (use `{url}` as the
// placeholder); defaults to is.gd. For non-GET / JSON shorteners, implement
// ShortenerProvider and return it from here.
export function createShortener(config: Config): ShortenerProvider {
  return new HttpShortenerProvider(config.SHORTENER_ENDPOINT);
}
