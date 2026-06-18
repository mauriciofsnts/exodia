import youtubeDl from "youtube-dl-exec";
import { ytdlpLimiter } from "@/lib/ytdlp.js";

// The default export is callable at runtime, but under NodeNext its type loses
// the call signature (it keeps only { exec, create }) — cast to the callable form.
const ytDlp = youtubeDl as unknown as (
  url: string,
  flags: Record<string, unknown>,
) => Promise<unknown>;

export interface SearchResult {
  title: string;
  url: string;
  duration: number; // seconds
}

interface YtdlVideo {
  id?: string;
  title?: string;
  webpage_url?: string;
  duration?: number;
}

interface YtdlResult extends YtdlVideo {
  entries?: YtdlVideo[];
}

function toResult(video: YtdlVideo): SearchResult | null {
  const url =
    video.webpage_url ?? (video.id ? `https://www.youtube.com/watch?v=${video.id}` : null);
  if (!url || !video.title) return null;
  return { title: video.title, url, duration: Math.round(video.duration ?? 0) };
}

// Resolves a single track from a free-text query or a direct URL via yt-dlp. A
// bare query becomes a `ytsearch1:` lookup; a URL is resolved directly.
export async function searchYouTube(query: string): Promise<SearchResult | null> {
  const result = (await ytdlpLimiter.run(() =>
    ytDlp(query, {
      dumpSingleJson: true,
      defaultSearch: "ytsearch1",
      noPlaylist: true,
      noWarnings: true,
      quiet: true,
    }),
  )) as YtdlResult;

  // Searches return a playlist with one entry; a direct URL returns the video.
  return toResult(result.entries?.[0] ?? result);
}

// Returns up to `limit` candidates for a free-text query, for a selection menu.
// Uses a flat playlist dump (no per-video extraction) so the list comes back
// fast; the chosen track is fully resolved later when it streams.
export async function searchYouTubeMany(query: string, limit: number): Promise<SearchResult[]> {
  const result = (await ytdlpLimiter.run(() =>
    ytDlp(query, {
      dumpSingleJson: true,
      flatPlaylist: true,
      defaultSearch: `ytsearch${limit}`,
      noWarnings: true,
      quiet: true,
    }),
  )) as YtdlResult;

  const entries = result.entries ?? [];
  return entries
    .map(toResult)
    .filter((r): r is SearchResult => r !== null)
    .slice(0, limit);
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
