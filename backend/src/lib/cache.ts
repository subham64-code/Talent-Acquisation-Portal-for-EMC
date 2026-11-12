import { env } from "../config/env";

/**
 * In-process cache used for hot-path reads (dashboard analytics, career listings,
 * databank pages, report payloads).
 *
 * It is deliberately dependency free and self-cleaning: entries expire after
 * their TTL and the map is capped so memory can never grow unbounded.
 */
interface Entry<T> {
  value: T;
  expiresAt: number;
}
const store = new Map<string, Entry<unknown>>();
let hits = 0;
let misses = 0;

const MAX_ENTRIES = 2000;

/** Removes expired entries and enforces the size cap (LRU-ish eviction). */
function sweep() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
  if (store.size > MAX_ENTRIES) {
    const excess = store.size - MAX_ENTRIES;
    let removed = 0;
    for (const key of store.keys()) {
      store.delete(key);
      if (++removed >= excess) break;
    }
  }
}

/** Read-through cache. On a miss the loader runs and the result is stored. */
export async function cached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = store.get(key) as Entry<T> | undefined;

  if (entry && entry.expiresAt > now) {
    hits++;
    // Refresh recency so hot keys survive the sweep.
    store.delete(key);
    store.set(key, entry);
    return entry.value;
  }

  if (entry) store.delete(key);
  misses++;

  const value = await loader();

  if (env.cacheEnabled) {
    store.set(key, { value, expiresAt: now + ttlSeconds * 1000 });
    if (store.size > MAX_ENTRIES) sweep();
  }

  return value;
}

/** Removes one or more cache keys. */
export async function invalidate(...keys: string[]): Promise<void> {
  for (const key of keys) store.delete(key);
}

/** Removes every key matching a prefix (a trailing "*" is allowed for glob-style calls). */
export async function invalidatePattern(prefix: string): Promise<void> {
  const normalized = prefix.endsWith("*") ? prefix.slice(0, -1) : prefix;
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(normalized)) store.delete(key);
  }
}

export function cacheStats() {
  sweep();
  const total = hits + misses;
  return {
    entries: store.size,
    hits,
    misses,
    hitRate: total ? Math.round((hits / total) * 100) : 0,
  };
}

export function clearCache(): void {
  store.clear();
  hits = 0;
  misses = 0;
}

export const CACHE_KEYS = {
  dashboardOverview: () => "emc:dashboard:overview",
  dashboardDepartments: () => "emc:dashboard:departments",
  dashboardCharts: () => "emc:dashboard:charts",
  publicOpenings: (page: number, size: number, search: string, dept: string) =>
    `emc:career:openings:${page}:${size}:${search || "-"}:${dept || "-"}`,
  publicDepartments: () => "emc:career:departments",
  databank: (page: number, size: number, q: string) => `emc:databank:${page}:${size}:${q || "-"}`,
  report: (type: string, key: string) => `emc:report:${type}:${key}`,
  notificationsUnread: (userId: string) => `emc:notifications:unread:${userId}`,
  openingsList: (page: number, size: number, status: string, search: string) =>
    `emc:openings:${page}:${size}:${status || "-"}:${search || "-"}`,
  applicationsList: (page: number, size: number, filters: string) => `emc:applications:${page}:${size}:${filters}`,
  candidatesList: (page: number, size: number, q: string) => `emc:candidates:${page}:${size}:${q || "-"}`,
  employeesList: (page: number, size: number, filters: string) => `emc:employees:${page}:${size}:${filters}`,
};
