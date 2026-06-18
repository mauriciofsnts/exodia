// Lightweight YouTube search suggestions (the same source the search box uses).
// Returns just suggestion strings — fast enough for slash-command autocomplete,
// unlike a full yt-dlp lookup per keystroke.
export async function youtubeSuggest(query: string): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(trimmed)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
  if (!res.ok) return [];

  // The "firefox" client returns plain JSON: [query, [suggestions...]].
  const data = (await res.json()) as [string, string[]];
  return Array.isArray(data[1]) ? data[1] : [];
}
