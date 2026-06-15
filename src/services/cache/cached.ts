import type { Redis } from "ioredis";

// Read-through cache for a JSON-serializable value. On a hit, returns the cached
// value; on a miss, runs `produce`, caches it with a TTL, and returns it. Redis
// failures degrade gracefully — a cache problem never fails the request, and
// producer errors are propagated (never cached).
export async function cached<T>(
  redis: Redis,
  key: string,
  ttlSeconds: number,
  produce: () => Promise<T>,
): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit !== null) return JSON.parse(hit) as T;
  } catch {
    // cache read/parse failed — fall through and produce fresh
  }

  const value = await produce();
  // Fire-and-forget write; a Redis hiccup shouldn't delay or fail the response.
  void redis.set(key, JSON.stringify(value), "EX", ttlSeconds).catch(() => {});
  return value;
}
