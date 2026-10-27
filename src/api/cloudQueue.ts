import AsyncStorage from '@react-native-async-storage/async-storage';
import { showGlobalToast } from '../utils/toastBus';
import {
  isNetworkOnline,
  setNetworkSyncingStatus,
  setPendingMutationsCount,
} from '../services/networkService';

/**
 * Serialized, batched offline-first write queue for the Apps Script backend.
 *
 * Why a persistent queue:
 *  - Supports offline actions: user changes are stored locally in AsyncStorage;
 *  - Automatic sync on reconnect: flushes pending writes when connection returns;
 *  - Apps Script serializes requests with a script lock, so batching prevents lock contention;
 *  - Coalesces duplicate edits (e.g., payment toggle, repeated expense edits);
 *  - Prevents data loss when the app is backgrounded or killed while offline.
 */

export interface CloudQueueResponse {
  success: boolean;
  error?: string;
  status?: number;
  retryAfterMs?: number;
  results?: CloudQueueResponse[];
}

export interface CloudQueueOperationInput {
  action: string;
  data: Record<string, unknown>;
  partyId?: string;
  /**
   * Pending operations with the same key replace each other (last write wins).
   * The first operation's onFailure is preserved so a rollback returns to the
   * state before the first optimistic change.
   */
  coalesceKey?: string;
  debounceMs?: number;
  /** Higher priority operations are sent first. */
  priority?: number;
  maxRetries?: number;
  onSuccess?: (response: CloudQueueResponse) => void;
  onFailure?: (response: CloudQueueResponse) => void;
  failureMessage?: string;
  silent?: boolean;
}

export interface CloudQueueExecutor {
  executeBatch: (
    operations: { action: string; data: Record<string, unknown> }[]
  ) => Promise<CloudQueueResponse>;
  executeSingle: (operation: {
    action: string;
    data: Record<string, unknown>;
  }) => Promise<CloudQueueResponse>;
  onCommitted?: (
    operations: { action: string; partyId?: string; data: Record<string, unknown> }[]
  ) => void;
  onQueueDrained?: () => void;
}

interface QueueItem {
  id: number;
  action: string;
  data: Record<string, unknown>;
  partyId?: string;
  coalesceKey?: string;
  debounceMs: number;
  priority: number;
  maxRetries: number;
  attempts: number;
  createdAt: number;
  onSuccess?: (response: CloudQueueResponse) => void;
  onFailure?: (response: CloudQueueResponse) => void;
  failureMessage: string;
  silent: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  /** Set when the user leaves/resets the room while the request is in flight. */
  cancelled: boolean;
}

interface PersistedQueueItem {
  id: number;
  action: string;
  data: Record<string, unknown>;
  partyId?: string;
  coalesceKey?: string;
  priority: number;
  attempts: number;
  createdAt: number;
  failureMessage?: string;
  silent?: boolean;
}

const OFFLINE_STORAGE_KEY = '@partysplit:offline_mutation_queue_v1';
const BATCH_SIZE = 8;
const FLUSH_WINDOW_MS = 120;
const DEFAULT_MAX_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 10000;

let executor: CloudQueueExecutor | null = null;
let sequence = 0;
let batchDisabled = false;
let processing = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let writeRevision = 0;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

const delayed: QueueItem[] = [];
const ready: QueueItem[] = [];
const inFlight: QueueItem[] = [];

function updatePendingBadge(): void {
  const total = delayed.length + ready.length + inFlight.length;
  setPendingMutationsCount(total);
}

function persistQueue(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const allItems: QueueItem[] = [...delayed, ...ready, ...inFlight].filter(
      (item) => !item.cancelled
    );
    const serialized: PersistedQueueItem[] = allItems.map((item) => ({
      id: item.id,
      action: item.action,
      data: item.data,
      partyId: item.partyId,
      coalesceKey: item.coalesceKey,
      priority: item.priority,
      attempts: item.attempts,
      createdAt: item.createdAt,
      failureMessage: item.failureMessage,
      silent: item.silent,
    }));
    AsyncStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(serialized)).catch(
      (err) => console.warn('[CloudQueue] Persist error:', err)
    );
  }, 150);
}

export function configureCloudQueue(next: CloudQueueExecutor): void {
  executor = next;
}

type QueueDrainedListener = () => void;
const queueDrainedListeners = new Set<QueueDrainedListener>();

export function addQueueDrainedListener(listener: QueueDrainedListener): () => void {
  queueDrainedListeners.add(listener);
  return () => {
    queueDrainedListeners.delete(listener);
  };
}

/** Re-enables batching after a successful check/redeploy or URL change. */
export function resetCloudQueueBatchSupport(): void {
  batchDisabled = false;
}

function isNetworkError(response: CloudQueueResponse): boolean {
  if (response.status === 0) return true;
  const message = (response.error || '').toLowerCase();
  return (
    !isNetworkOnline() ||
    /(сеть|network|failed to fetch|offline|оффлайн|не удалось подключиться|econnrefused|internet|timeout|timed out|abort)/i.test(
      message
    )
  );
}

function isRetryable(response: CloudQueueResponse): boolean {
  if (response.success) return false;
  if (response.retryAfterMs) return true;
  if (response.status === 0) return true;
  if (response.status === 429) return true;
  if (typeof response.status === 'number' && response.status >= 500) return true;

  const message = (response.error || '').toLowerCase();
  return /(сеть|network|failed to fetch|timeout|timed out|время ожидания|перегружен|too many|429|quota|квот|лимит запросов|temporar|try again|повторите)/i.test(
    message
  );
}

function isBatchUnsupported(response: CloudQueueResponse): boolean {
  const message = (response.error || '').toLowerCase();
  return /неизвестное действие.*batch|batch.*неизвест|unsupported action|старой версии|backend[\\/]code\.gs/i.test(
    message
  );
}

function retryDelay(item: QueueItem): number {
  const exponential = Math.min(
    BASE_RETRY_DELAY_MS * Math.pow(2, Math.max(0, item.attempts - 1)),
    MAX_RETRY_DELAY_MS
  );
  return exponential + Math.floor(Math.random() * 350);
}

function scheduleFlush(delay = FLUSH_WINDOW_MS): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void processQueue();
  }, delay);
}

function scheduleItem(item: QueueItem): void {
  if (item.timer) {
    clearTimeout(item.timer);
    item.timer = null;
  }
  if (item.debounceMs > 0) {
    item.timer = setTimeout(() => {
      item.timer = null;
      const index = delayed.indexOf(item);
      if (index >= 0) delayed.splice(index, 1);
      ready.push(item);
      scheduleFlush();
    }, item.debounceMs);
    return;
  }
  ready.push(item);
  scheduleFlush();
}

function findCoalescable(key: string): QueueItem | null {
  const queued = delayed.find((item) => item.coalesceKey === key);
  if (queued) return queued;
  return ready.find((item) => item.coalesceKey === key) || null;
}

function mergeInto(existing: QueueItem, incoming: QueueItem): void {
  existing.action = incoming.action;
  // updateShoppingItem sends field diffs (only the fields the user changed).
  // Their payloads must accumulate while coalesced, otherwise every edit
  // inside one debounce window would drop the edits of the previous one.
  // All other actions send full snapshots, so replacing the data is correct.
  existing.data =
    incoming.action === 'updateShoppingItem'
      ? { ...existing.data, ...incoming.data }
      : incoming.data;
  existing.partyId = incoming.partyId || existing.partyId;
  existing.debounceMs = incoming.debounceMs;
  existing.priority = Math.max(existing.priority, incoming.priority);
  existing.maxRetries = Math.max(existing.maxRetries, incoming.maxRetries);
  if (!existing.onFailure) existing.onFailure = incoming.onFailure;
  if (incoming.onSuccess) existing.onSuccess = incoming.onSuccess;
  if (incoming.failureMessage) existing.failureMessage = incoming.failureMessage;
  existing.silent = existing.silent && incoming.silent;
}

export function enqueueCloudWrite(input: CloudQueueOperationInput): number {
  writeRevision += 1;
  const incoming: QueueItem = {
    id: ++sequence,
    action: input.action,
    data: input.data,
    partyId: input.partyId,
    coalesceKey: input.coalesceKey,
    debounceMs: Math.max(0, input.debounceMs ?? 0),
    priority: input.priority ?? 0,
    maxRetries: input.maxRetries ?? DEFAULT_MAX_RETRIES,
    attempts: 0,
    createdAt: Date.now(),
    onSuccess: input.onSuccess,
    onFailure: input.onFailure,
    failureMessage: input.failureMessage || 'Не удалось сохранить изменения в Google Sheets',
    silent: Boolean(input.silent),
    timer: null,
    cancelled: false,
  };

  if (incoming.coalesceKey) {
    const existing = findCoalescable(incoming.coalesceKey);
    if (existing) {
      mergeInto(existing, incoming);
      if (existing.timer) {
        clearTimeout(existing.timer);
        existing.timer = null;
      }
      if (delayed.includes(existing)) {
        scheduleItem(existing);
      } else {
        scheduleFlush();
      }
      persistQueue();
      updatePendingBadge();
      return existing.id;
    }
  }

  if (incoming.debounceMs > 0) {
    delayed.push(incoming);
  }
  scheduleItem(incoming);
  persistQueue();
  updatePendingBadge();
  return incoming.id;
}

function finalFailure(item: QueueItem, response: CloudQueueResponse): void {
  try {
    item.onFailure?.(response);
  } catch (error) {
    console.warn('[CloudQueue] Failure callback error:', error);
  }

  if (!item.silent) {
    const detail = (response.error || '').trim();
    showGlobalToast(
      detail ? `${item.failureMessage}: ${detail}` : item.failureMessage,
      { type: 'error', duration: 5000 }
    );
  }
}

function scheduleRetry(item: QueueItem, response: CloudQueueResponse): void {
  item.attempts += 1;
  const serverDelay = Math.max(0, response.retryAfterMs || 0);
  item.debounceMs = Math.max(retryDelay(item), serverDelay);
  delayed.push(item);
  scheduleItem(item);
  persistQueue();
  updatePendingBadge();
}

function handleResult(item: QueueItem, response: CloudQueueResponse): void {
  if (item.cancelled) return;

  if (response.success) {
    try {
      item.onSuccess?.(response);
    } catch (error) {
      console.warn('[CloudQueue] Success callback error:', error);
    }
    return;
  }

  // If network is down or request failed due to connectivity, retain in offline queue indefinitely
  if (isNetworkError(response)) {
    scheduleRetry(item, response);
    return;
  }

  // Normal transient server errors (e.g. 5xx, rate limits) retry up to maxRetries
  if (isRetryable(response) && item.attempts < item.maxRetries) {
    scheduleRetry(item, response);
    return;
  }

  finalFailure(item, response);
}

function committedOperation(item: QueueItem) {
  return { action: item.action, partyId: item.partyId, data: item.data };
}

function normalizeThrown(error: unknown): CloudQueueResponse {
  const message = error instanceof Error ? error.message : String(error || '');
  return {
    success: false,
    status: 0,
    error: message || 'Ошибка сети',
  };
}

async function runIndividually(items: QueueItem[]): Promise<void> {
  if (!executor) {
    items.forEach((item) => {
      if (!item.cancelled) {
        finalFailure(item, {
          success: false,
          error: 'Очередь синхронизации не настроена',
        });
      }
    });
    return;
  }

  const committed: ReturnType<typeof committedOperation>[] = [];
  for (const item of items) {
    if (item.cancelled) continue;
    try {
      const response = await executor.executeSingle({
        action: item.action,
        data: item.data,
      });
      if (!item.cancelled && response.success) {
        committed.push(committedOperation(item));
      }
      handleResult(item, response);
    } catch (error) {
      handleResult(item, normalizeThrown(error));
    }
  }
  executor.onCommitted?.(committed);
}

async function processQueue(): Promise<void> {
  if (processing || ready.length === 0) return;
  if (!executor) return;

  // If offline, preserve ready queue and wait for reconnect
  if (!isNetworkOnline()) {
    updatePendingBadge();
    return;
  }

  const batch = ready
    .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)
    .splice(0, BATCH_SIZE);
  if (batch.length === 0) return;

  processing = true;
  inFlight.push(...batch);
  setNetworkSyncingStatus(true);

  try {
    if (batchDisabled) {
      await runIndividually(batch);
      return;
    }

    let response: CloudQueueResponse;
    try {
      response = await executor.executeBatch(
        batch.map((item) => ({ action: item.action, data: item.data }))
      );
    } catch (error) {
      response = normalizeThrown(error);
    }

    if (!response.success && isBatchUnsupported(response)) {
      batchDisabled = true;
      await runIndividually(batch);
      return;
    }

    if (
      !response.success ||
      !Array.isArray(response.results) ||
      response.results.length !== batch.length
    ) {
      batch.forEach((item) => handleResult(item, response));
      return;
    }

    const committed: ReturnType<typeof committedOperation>[] = [];
    batch.forEach((item, index) => {
      const result = response.results![index];
      if (!item.cancelled && result.success) {
        committed.push(committedOperation(item));
      }
      handleResult(item, result);
    });
    executor.onCommitted?.(committed);
  } finally {
    batch.forEach((item) => {
      const index = inFlight.indexOf(item);
      if (index >= 0) inFlight.splice(index, 1);
    });
    processing = false;
    persistQueue();
    updatePendingBadge();



    const remaining = delayed.length + ready.length + inFlight.length;
    if (remaining === 0) {
      setNetworkSyncingStatus(false, Date.now());
      executor.onQueueDrained?.();
      queueDrainedListeners.forEach((fn) => {
        try {
          fn();
        } catch (e) {
          console.warn('[CloudQueue] Drained listener error:', e);
        }
      });
    } else if (ready.length > 0 && isNetworkOnline()) {
      scheduleFlush(0);
    }
  }
}

/**
 * Hydrates persisted queue from local storage on app start.
 */
export async function hydrateOfflineQueue(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as PersistedQueueItem[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      parsed.forEach((p) => {
        if (
          ready.some((r) => r.id === p.id) ||
          delayed.some((d) => d.id === p.id)
        ) {
          return;
        }
        sequence = Math.max(sequence, p.id);
        const item: QueueItem = {
          id: p.id,
          action: p.action,
          data: p.data,
          partyId: p.partyId,
          coalesceKey: p.coalesceKey,
          debounceMs: 0,
          priority: p.priority || 0,
          maxRetries: DEFAULT_MAX_RETRIES,
          attempts: p.attempts || 0,
          createdAt: p.createdAt || Date.now(),
          failureMessage: p.failureMessage || 'Не удалось сохранить изменения',
          silent: Boolean(p.silent),
          timer: null,
          cancelled: false,
        };
        ready.push(item);
      });
      writeRevision += 1;
      updatePendingBadge();
      if (isNetworkOnline()) {
        scheduleFlush(300);
      }
    }
  } catch (err) {
    console.warn('[CloudQueue] Hydrate error:', err);
  }
}

/**
 * Flushes all pending and delayed writes immediately (called upon reconnect).
 */
export function flushOfflineQueue(): void {
  while (delayed.length > 0) {
    const item = delayed.shift()!;
    if (item.timer) {
      clearTimeout(item.timer);
      item.timer = null;
    }
    item.debounceMs = 0;
    ready.push(item);
  }
  scheduleFlush(0);
}

/**
 * Checks if a specific transfer status toggle is in the offline queue waiting to be synced.
 */
export function isOperationPendingForTransfer(
  partyId: string,
  transferId: string
): boolean {
  const all = [...delayed, ...ready, ...inFlight];
  return all.some(
    (item) =>
      item.partyId === partyId &&
      (item.coalesceKey === `transfer:status:${partyId}:${transferId}` ||
        (item.action === 'setTransferStatus' && item.data?.transferId === transferId))
  );
}

/**
 * Checks if an expense item operation is in the offline queue.
 */
export function isOperationPendingForExpense(
  partyId: string,
  expenseId: string
): boolean {
  const all = [...delayed, ...ready, ...inFlight];
  return all.some(
    (item) =>
      item.partyId === partyId &&
      (item.coalesceKey === `expense:update:${partyId}:${expenseId}` ||
        item.coalesceKey === `expense:add:${partyId}:${expenseId}` ||
        item.action === 'addExpense' && (item.data?.expense as any)?.id === expenseId ||
        item.action === 'deleteExpense' && item.data?.expenseId === expenseId ||
        item.data?.id === expenseId)
  );
}

/**
 * Checks if a shopping item operation is in the offline queue.
 * Strictly scoped to shopping: an unrelated operation whose payload merely
 * contains the same id field must not freeze the merge for this item.
 */
export function isOperationPendingForShoppingItem(
  partyId: string,
  itemId: string
): boolean {
  const all = [...delayed, ...ready, ...inFlight];
  const coalesceSuffix = `${partyId}:${itemId}`;
  return all.some(
    (item) =>
      item.partyId === partyId &&
      (item.coalesceKey === `shopping:update:${coalesceSuffix}` ||
        item.coalesceKey === `shopping:add:${coalesceSuffix}` ||
        item.coalesceKey === `shopping:delete:${coalesceSuffix}` ||
        (item.action === 'addShoppingItem' &&
          (item.data?.id === itemId || item.data?.itemId === itemId)) ||
        (item.action === 'updateShoppingItem' &&
          (item.data?.id === itemId || item.data?.itemId === itemId)) ||
        (item.action === 'deleteShoppingItem' &&
          (item.data?.id === itemId || item.data?.itemId === itemId)))
  );
}

/** True while any debounce, retry, queued or in-flight write exists. */
export function hasPendingCloudWrites(): boolean {
  return delayed.length > 0 || ready.length > 0 || inFlight.length > 0;
}

export function getPendingCloudWriteCount(): number {
  return delayed.length + ready.length + inFlight.length;
}

/** Read this before a fetch and compare after it to detect concurrent writes. */
export function getCloudWriteRevision(): number {
  return writeRevision;
}

/**
 * Waits until debounce/retry/in-flight work is drained.
 */
export async function waitForCloudWrites(timeoutMs = 6000): Promise<boolean> {
  const startedAt = Date.now();
  while (hasPendingCloudWrites()) {
    if (Date.now() - startedAt >= timeoutMs) return false;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return true;
}

/**
 * Drops operations that the user has already superseded.
 */
export function cancelCloudWrites(
  predicate: (operation: {
    action: string;
    partyId?: string;
    data: Record<string, unknown>;
  }) => boolean
): number {
  let removed = 0;
  const remove = (list: QueueItem[]) => {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const item = list[i];
      if (!predicate({ action: item.action, partyId: item.partyId, data: item.data })) {
        continue;
      }
      if (item.timer) {
        clearTimeout(item.timer);
        item.timer = null;
      }
      list.splice(i, 1);
      removed += 1;
    }
  };
  remove(delayed);
  remove(ready);
  for (let i = 0; i < inFlight.length; i += 1) {
    const item = inFlight[i];
    if (predicate({ action: item.action, partyId: item.partyId, data: item.data })) {
      item.cancelled = true;
      removed += 1;
    }
  }
  if (removed > 0) {
    writeRevision += 1;
    persistQueue();
    updatePendingBadge();
  }
  return removed;
}
