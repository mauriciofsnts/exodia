import youtubeDl from "youtube-dl-exec";

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

// Resolves a track from a free-text query or a direct URL via yt-dlp. A bare
// query becomes a `ytsearch1:` lookup; a URL is resolved directly.
export async function searchYouTube(query: string): Promise<SearchResult | null> {
  const result = (await ytDlp(query, {
    dumpSingleJson: true,
    defaultSearch: "ytsearch1",
    noPlaylist: true,
    noWarnings: true,
    quiet: true,
  })) as YtdlResult;

  // Searches return a playlist with one entry; a direct URL returns the video.
  const video = result.entries?.[0] ?? result;
  const url =
    video.webpage_url ?? (video.id ? `https://www.youtube.com/watch?v=${video.id}` : null);
  if (!url || !video.title) return null;

  return { title: video.title, url, duration: Math.round(video.duration ?? 0) };
}
