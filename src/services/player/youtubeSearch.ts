import type { Track as LavalinkTrack } from "shoukaku";

export interface SearchResult {
  title: string;
  url: string;
  duration: number; // seconds
}

// Maps a Lavalink track (from the youtube-source plugin) to our UI-facing shape.
// Lengths come back in milliseconds; a track without a `uri` (rare) is unplayable
// for us — the caller filters those out.
export function toSearchResult(track: LavalinkTrack): SearchResult | null {
  if (!track.info.uri) return null;
  return {
    title: track.info.title,
    url: track.info.uri,
    duration: Math.round((track.info.length ?? 0) / 1000),
  };
}

// Best-effort YouTube thumbnail from a watch/short/embed/youtu.be URL. Returns
// null for non-YouTube URLs so the caller can skip setting one.
export function youtubeThumbnail(url: string): string | null {
  const id =
    url.match(/[?&]v=([\w-]{11})/)?.[1] ??
    url.match(/youtu\.be\/([\w-]{11})/)?.[1] ??
    url.match(/\/(?:shorts|embed)\/([\w-]{11})/)?.[1] ??
    null;
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}
