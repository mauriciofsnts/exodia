import type { Client } from "discord.js";
import type { Redis } from "ioredis";
import type { Config } from "@/config/index";
import type { I18n } from "@/i18n/index";
import type { Logger } from "@/lib/logger";
import type { EconomyRepository } from "@/services/economy/economyRepository";
import type { EventRepository } from "@/services/events/eventRepository";
import type { GuildConfigService } from "@/services/guild/guildConfig";
import type { TrackSearchCache } from "@/services/music/searchCache";
import type { VoteRepository } from "@/services/music/voteRepository";
import type { PlayerManager } from "@/services/player/playerManager";
import type { PollRepository } from "@/services/polls/pollRepository";
import type { CommandDefinition } from "./commandBuilder";
import type { CommandSyncRepository } from "./commandSync/repository";
import type { Database } from "./database";

export interface BotContext {
  client: Client;
  config: Config;
  logger: Logger;
  db: Database | null;
  cache: Redis;
  player: PlayerManager;
  i18n: I18n;
  guildConfig: GuildConfigService; // per-guild prefix/locale settings (Redis-backed)
  trackCache: TrackSearchCache | null; // query→track persistence; null when db is off
  votes: VoteRepository | null; // play-card reaction votes; null when db is off
  events: EventRepository | null; // scheduled guild events; null when db is off
  commandSync: CommandSyncRepository | null; // per-guild slash command sync state; null when db is off
  economy: EconomyRepository | null; // per-guild points ledger (grants/leaderboard/bets); null when db is off
  polls: PollRepository | null; // per-guild polls + betting/settlement; null when db is off
  commands: CommandDefinition[]; // all loaded commands — populated by Bot after load (for /help)
}
