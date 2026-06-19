import { CommandSyncRepository } from "@/core/commandSync/repository.js";
import type { Database } from "@/core/database.js";
import { EventRepository } from "./events/eventRepository.js";
import { TrackSearchCache } from "./music/searchCache.js";
import { VoteRepository } from "./music/voteRepository.js";

// Services backed by the optional Postgres database — all null when DATABASE_URL
// is unset, so the bot runs fine without persistence.
export interface PersistenceServices {
  trackCache: TrackSearchCache | null;
  votes: VoteRepository | null;
  events: EventRepository | null;
  commandSync: CommandSyncRepository | null;
}

// Constructs every DB-backed service and creates its tables in one place. To add
// a new persisted service: list it in `services` and add its field above —
// index.ts never changes. Every entry just needs an `init(): Promise<void>`.
export async function createPersistence(db: Database | null): Promise<PersistenceServices> {
  if (!db) return { trackCache: null, votes: null, events: null, commandSync: null };

  const services = {
    trackCache: new TrackSearchCache(db),
    votes: new VoteRepository(db),
    events: new EventRepository(db),
    commandSync: new CommandSyncRepository(db),
  };

  await Promise.all(Object.values(services).map((service) => service.init()));

  return services;
}
