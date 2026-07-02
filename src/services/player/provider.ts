import type { Client, VoiceBasedChannel } from "discord.js";
import type { Config } from "@/config/index";
import type { Logger } from "@/lib/logger";
import { LavalinkProvider } from "./lavalinkProvider";
import type { Track } from "./track";
import type { SearchResult } from "./youtubeSearch";
import { YtdlProvider } from "./ytdlProvider";

// How a track finished, as far as the queue is concerned: a clean finish advances
// silently, a failure is reported to the requester before advancing.
export type TrackEndResult = "finished" | "failed";

// Detached playback errors (Lavalink node faults, stream exceptions) fire outside
// any command, so they bypass the command middleware. A reporter lets the host
// wire them to the admin notifier without coupling the player to discord.js.
export interface PlayerErrorReport {
  guildId: string;
  stage: "player" | "stream";
  url?: string;
}
export type PlayerErrorReporter = (err: unknown, report: PlayerErrorReport) => void;

// Per-guild playback handle owned by a provider. Abstracts the mechanical
// differences between Lavalink (remote player) and ytdl (@discordjs/voice) so
// PlayerManager can drive the queue without knowing which backend is in use.
//
// Contract: onEnd fires EXACTLY ONCE per play() call — each provider dedups its
// own backend events — so PlayerManager's queue-advance can never double-fire.
export interface AudioSession {
  // Resolves track.url and starts streaming it, replacing whatever was playing.
  play(track: Track): Promise<void>;
  pause(): void;
  resume(): void;
  readonly paused: boolean;
  setVolume(percent: number): void; // 0–200 (100 = original loudness)
  stopTrack(): void; // stop the current track → triggers onEnd("finished")
  destroy(): Promise<void>; // leave voice + release backend resources
  onEnd(cb: (result: TrackEndResult) => void): void;
  onClosed(cb: () => void): void; // the voice connection dropped for good
}

// Provider-specific mechanics behind PlayerManager: connection, search, and voice
// join. Everything provider-agnostic (queue, idle timer, volume state, notifier,
// error reporting) stays in PlayerManager.
export interface AudioProvider {
  // Called once before login. Lavalink builds its Shoukaku client here; ytdl is a
  // no-op (it reads voice state from each guild's adapter at join time).
  connect(client: Client): void;
  // Resolves a single track for the command layer (URL or best search match).
  search(query: string): Promise<SearchResult | null>;
  // Up to `limit` candidates for a free-text query (for the selection menu).
  searchMany(query: string, limit: number): Promise<SearchResult[]>;
  // Joins the voice channel and returns a fresh per-guild session.
  joinVoice(channel: VoiceBasedChannel): Promise<AudioSession>;
  // Optional sink for detached faults the provider itself surfaces (e.g. a
  // Lavalink node error, which happens outside any guild session).
  setErrorReporter?(reporter: PlayerErrorReporter): void;
}

// Selects the audio backend from AUDIO_PROVIDER (defaults to Lavalink, the
// reliable option from a datacenter IP). See src/config for the trade-offs.
export function createAudioProvider(config: Config, logger: Logger): AudioProvider {
  return config.AUDIO_PROVIDER === "ytdl"
    ? new YtdlProvider(config, logger)
    : new LavalinkProvider(config, logger);
}
