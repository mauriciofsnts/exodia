import { CommandSyncRepository } from "@/core/commandSync/repository";
import type { Database } from "@/core/database";
import { runMigrations } from "@/infra/db/migrate";
import type { Logger } from "@/lib/logger";
import { EconomyRepository } from "./economy/economyRepository";
import { EventRepository } from "./events/eventRepository";
import { TrackSearchCache } from "./music/searchCache";
import { VoteRepository } from "./music/voteRepository";
import { PollRepository } from "./polls/pollRepository";

// Services backed by the optional Postgres database — all null when DATABASE_URL
// is unset, so the bot runs fine without persistence.
export interface PersistenceServices {
  trackCache: TrackSearchCache | null;
  votes: VoteRepository | null;
  events: EventRepository | null;
  commandSync: CommandSyncRepository | null;
  economy: EconomyRepository | null;
  polls: PollRepository | null;
}

// Brings the schema up to date (runMigrations) and constructs every DB-backed
// service in one place. To add a new persisted service: list it in the returned
// object and add its field above; add a new SQL file under infra/db/migrations/
// for its tables — index.ts never changes.
export async function createPersistence(
  db: Database | null,
  logger: Logger,
): Promise<PersistenceServices> {
  if (!db)
    return {
      trackCache: null,
      votes: null,
      events: null,
      commandSync: null,
      economy: null,
      polls: null,
    };

  await runMigrations(db, logger);

  const economy = new EconomyRepository(db);
  return {
    trackCache: new TrackSearchCache(db),
    votes: new VoteRepository(db),
    events: new EventRepository(db),
    commandSync: new CommandSyncRepository(db),
    economy,
    polls: new PollRepository(db, economy),
  };
}
