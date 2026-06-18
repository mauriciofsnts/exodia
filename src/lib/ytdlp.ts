import { Limiter } from "./limiter.js";

// Every yt-dlp call spawns a Python subprocess; bursts of them (many guilds
// starting playback at once, plus a search spawn per cold query) can exhaust CPU
// and memory. This caps how many yt-dlp *startups* run concurrently across the
// whole bot. Steady-state playback isn't throttled — the streaming side releases
// its slot once the audio is flowing (see PlayerManager.createTrackResource).
const MAX_CONCURRENT_YTDLP = 4;

export const ytdlpLimiter = new Limiter(MAX_CONCURRENT_YTDLP);
