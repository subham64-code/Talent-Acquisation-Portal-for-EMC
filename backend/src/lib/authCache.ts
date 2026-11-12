import { env } from "../config/env";
import type { AuthContext } from "../types/express";

interface Entry {
  context: AuthContext;
  expiresAt: number;
}

const store = new Map<string, Entry>();
const MAX_ENTRIES = 1000;

export function getCachedAuth(sessionId: string): AuthContext | undefined {
  const entry = store.get(sessionId);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    store.delete(sessionId);
    return undefined;
  }
  store.delete(sessionId);
  store.set(sessionId, entry);
  return entry.context;
}

export function setCachedAuth(sessionId: string, context: AuthContext): void {
  const ttlSeconds = env.authCacheTtlSeconds;
  if (!env.authCacheEnabled || ttlSeconds <= 0) return;
  store.set(sessionId, { context, expiresAt: Date.now() + ttlSeconds * 1000 });
  if (store.size > MAX_ENTRIES) {
    const excess = store.size - MAX_ENTRIES;
    let removed = 0;
    for (const key of store.keys()) {
      store.delete(key);
      if (++removed >= excess) break;
    }
  }
}

export function clearAuthCache(): void {
  store.clear();
}

export function invalidateAuthSessions(sessionIds: string[]): void {
  for (const id of sessionIds) store.delete(id);
}
