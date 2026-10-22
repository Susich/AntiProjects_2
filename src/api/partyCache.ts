import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PartyApiResponse } from './googleSheets';

/**
 * Two-level read cache for room snapshots:
 *  - memory: instant within a session and shared by concurrent screens;
 *  - AsyncStorage: survives an app restart and provides a stale fallback when
 *    the network is slow/unavailable.
 *
 * The current party in the Zustand store remains the primary optimistic state.
 * This cache only prevents duplicate `getPartyDetails` network calls and gives
 * the background revalidation a last-known-good snapshot.
 */
const STORAGE_KEY = '@partysplit:cloud_party_cache_v1';
const FRESH_TTL_MS = 2500;
const STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days offline fallback
const MAX_ENTRIES = 8;
// Room data is polled every ~8 seconds. Persisting every poll would cause
// unnecessary AsyncStorage writes and battery/IO churn; the in-memory copy is
// always fresh, while the restart/offline snapshot is throttled.
const PERSIST_INTERVAL_MS = 60000;

interface CacheEntry {
  savedAt: number;
  response: PartyApiResponse;
}

const memory = new Map<string, CacheEntry>();
let storageLoaded = false;
let storageLoad: Promise<void> | null = null;
let persistChain: Promise<void> = Promise.resolve();
let lastPersistAt = 0;

function hash(value: string): string {
  let result = 0;
  for (let i = 0; i < value.length; i += 1) {
    result = (result * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(result).toString(36);
}

export function getPartyCacheKey(
  scriptUrl: string,
  partyId: string,
  code?: string
): string {
  return `${hash(`${scriptUrl}|${partyId}`)}:${partyId}:${(code || '').toUpperCase()}`;
}

async function ensureStorageLoaded(): Promise<void> {
  if (storageLoaded) return;
  if (storageLoad) return storageLoad;

  storageLoad = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
        const now = Date.now();
        Object.entries(parsed).forEach(([key, entry]) => {
          if (
            entry &&
            typeof entry.savedAt === 'number' &&
            now - entry.savedAt <= STALE_TTL_MS &&
            entry.response?.success
          ) {
            memory.set(key, entry);
          }
        });
      }
    } catch (error) {
      console.warn('[PartyCache] Failed to load cache:', error);
    } finally {
      storageLoaded = true;
    }
  })();

  return storageLoad;
}

function persist(): Promise<void> {
  const now = Date.now();
  const entries = Array.from(memory.entries())
    .filter(([, entry]) => now - entry.savedAt <= STALE_TTL_MS)
    .sort((a, b) => b[1].savedAt - a[1].savedAt)
    .slice(0, MAX_ENTRIES);

  const payload: Record<string, CacheEntry> = {};
  entries.forEach(([key, entry]) => {
    payload[key] = entry;
  });

  persistChain = persistChain
    .catch(() => {})
    .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)))
    .catch((error) => {
      console.warn('[PartyCache] Failed to persist cache:', error);
    });

  return persistChain;
}

/** Returns a cached snapshot. If maxAgeMs is specified, checks age limit. */
export async function getCachedParty(
  key: string,
  maxAgeMs?: number
): Promise<PartyApiResponse | null> {
  await ensureStorageLoaded();
  const entry = memory.get(key);
  if (!entry) return null;
  if (typeof maxAgeMs === 'number' && Date.now() - entry.savedAt > maxAgeMs) return null;
  return entry.response;
}

export async function putCachedParty(
  key: string,
  response: PartyApiResponse
): Promise<void> {
  if (!response.success) return;
  await ensureStorageLoaded();
  memory.set(key, { savedAt: Date.now(), response });
  const now = Date.now();
  if (now - lastPersistAt < PERSIST_INTERVAL_MS) return;
  lastPersistAt = now;
  await persist();
}

/** Invalidates all snapshots for one room after any successful write. */
export async function invalidatePartyCacheForParty(partyId: string): Promise<void> {
  if (!partyId) return;
  await ensureStorageLoaded();
  const marker = `:${partyId}:`;
  let changed = false;
  Array.from(memory.keys()).forEach((key) => {
    if (key.includes(marker)) {
      memory.delete(key);
      changed = true;
    }
  });
  if (changed) await persist();
  // The next successful read should be persisted immediately; the previous
  // snapshot was just removed because it was stale relative to a write.
  lastPersistAt = 0;
}

export async function invalidateAllPartyCache(): Promise<void> {
  await ensureStorageLoaded();
  memory.clear();
  await persist();
  lastPersistAt = 0;
}

export { FRESH_TTL_MS, STALE_TTL_MS };
