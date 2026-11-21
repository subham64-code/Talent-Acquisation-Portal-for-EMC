import { env } from "../config/env";
import { prisma } from "./prisma";

/**
 * Fast in-process read cache with cluster-wide invalidation.
 *
 * Values stay in memory (no network hop on a cache hit). Invalidation is shared
 * through the `cache_generations` table: each namespace has a generation number
 * that is incremented by whichever server performs a write. Every other server
 * re-reads the counters at most once per SYNC_INTERVAL_MS and discards local
 * entries whose generation is behind. This avoids Redis while still preventing
 * stale data on a multi-instance deployment.
 */
interface Entry<T> {
  value: T;
  expiresAt: number;
  generation: number;
}

const store = new Map<string, Entry<unknown>>();
const localGenerations = new Map<string, number>();
let hits = 0;
let misses = 0;
let lastGenerationSync = 0;

const MAX_ENTRIES = 2000;
const SYNC_INTERVAL_MS = 1500;

/** `emc:dashboard:overview` and `emc:dashboard:charts` share one namespace. */
function namespaceOf(key: string): string {
  const parts = key.split(":");
  return parts.length > 1 ? parts.slice(0, 2).join(":") : key;
}

async function syncGenerations(): Promise<void> {
  const now = Date.now();
  if (now - lastGenerationSync < SYNC_INTERVAL_MS) return;
  lastGenerationSync = now;
  const rows = await prisma.cacheGeneration.findMany({ select: { namespace: true, generation: true } });
  for (const row of rows) localGenerations.set(row.namespace, row.generation);
}

/** Bump the shared counter so every replica drops this namespace. */
async function bumpGeneration(namespace: string): Promise<void> {
  const row = await prisma.cacheGeneration.upsert({
    where: { namespace },
    update: { generation: { increment: 1 } },
    create: { namespace, generation: 1 },
  });
  localGenerations.set(namespace, row.generation);
}

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
  // A failed generation sync must never break a page; serve from local memory.
  await syncGenerations().catch(() => undefined);
  const now = Date.now();
  const generation = localGenerations.get(namespaceOf(key)) ?? 0;
  const entry = store.get(key) as Entry<T> | undefined;

  if (entry && entry.expiresAt > now && entry.generation === generation) {
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
    store.set(key, { value, expiresAt: now + ttlSeconds * 1000, generation });
    if (store.size > MAX_ENTRIES) sweep();
  }

  return value;
}

/** Removes one or more cache keys locally and invalidates them everywhere. */
export async function invalidate(...keys: string[]): Promise<void> {
  const namespaces = new Set<string>();
  for (const key of keys) {
    namespaces.add(namespaceOf(key));
    for (const existing of Array.from(store.keys())) {
      if (existing === key || existing.startsWith(`${key}:`)) store.delete(existing);
    }
  }
  await Promise.all(Array.from(namespaces).map((ns) => bumpGeneration(ns).catch(() => undefined)));
}

/** Removes every key matching a prefix and invalidates that namespace everywhere. */
export async function invalidatePattern(prefix: string): Promise<void> {
  const normalized = prefix.endsWith("*") ? prefix.slice(0, -1) : prefix;
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(normalized)) store.delete(key);
  }
  await bumpGeneration(namespaceOf(normalized)).catch(() => undefined);
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
  applicationsList: (page: number, size: number, filters: string) => `emc:applications:${page}:${size}:${filters}`,
};
