import { useEffect } from 'react';
import { AppState } from 'react-native';
import { hasPendingCloudWrites } from '../api/cloudQueue';
import { usePartyStore } from '../store/usePartyStore';
import { isNetworkOnline } from '../services/networkService';

/**
 * Background revalidation (stale-while-revalidate) for the room.
 *
 * The store already renders the locally cached party immediately during
 * hydration, so this hook never gates the UI on the network. It only refreshes
 * in the background. Apps Script has no WebSocket/SSE channel, so polling is
 * still the realtime mechanism — but it now:
 *  - waits while optimistic writes are in the queue (to avoid overwriting
 *    local changes with an older snapshot);
 *  - backs off exponentially on network/server errors;
 *  - pauses in the background and forces a fresh read on foreground;
 *  - uses the API read cache / in-flight deduplication.
 */
const DEFAULT_INTERVAL_MS = 4000;
const MAX_INTERVAL_MS = 60000;

export function useCloudAutoSync(intervalMs: number = DEFAULT_INTERVAL_MS): void {
  const code = usePartyStore((s) => s.currentParty.code);
  const session = usePartyStore((s) => s.session);

  useEffect(() => {
    if (!code || !session) return;

    let active = true;
    let paused = false;
    let running = false;
    let forceRequested = false;
    let nextDelay = intervalMs;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const schedule = (delay: number, force = false) => {
      if (!active || paused) return;
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        void sync(force);
      }, delay);
    };

    const sync = async (force = false) => {
      if (!active || paused) return;
      if (running) {
        // A forced foreground refresh arrived while a poll was in flight.
        if (force) forceRequested = true;
        return;
      }

      if (!isNetworkOnline()) {
        schedule(Math.max(intervalMs, 10000), force);
        return;
      }

      const state = usePartyStore.getState();
      if (!state.currentParty.code || !state.session) return;

      // A poll during an optimistic write would fetch the pre-write sheet and
      // briefly revert the UI. Wait for the queue instead.
      if (hasPendingCloudWrites()) {
        schedule(Math.min(intervalMs, 2500), force);
        return;
      }

      running = true;
      let success = false;
      try {
        const result = await state.syncWithCloud({
          background: true,
          forceRefresh: force,
        });
        // A stale snapshot means the network request failed; back off even
        // though the cached room remains visible.
        success = result.success && !result.stale;
      } catch {
        success = false;
      } finally {
        running = false;
        if (!active) return;

        nextDelay = success
          ? intervalMs
          : Math.min(Math.round(nextDelay * 1.8), MAX_INTERVAL_MS);

        // Run a queued foreground refresh immediately instead of waiting out
        // the normal interval.
        const runForcedNext = forceRequested;
        forceRequested = false;
        schedule(
          runForcedNext ? 0 : nextDelay + Math.floor(Math.random() * 600),
          runForcedNext
        );
      }
    };

    // On mount: force one network read. Cached data is already visible.
    schedule(0, true);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        paused = false;
        nextDelay = intervalMs;
        // Return from background: bypass the read cache and refresh now.
        schedule(0, true);
      } else {
        // App is in background: continue polling with a gentle 25s interval
        // so participants outside the app receive phone system notifications.
        paused = false;
        nextDelay = Math.max(intervalMs, 25000);
        schedule(nextDelay);
      }
    });

    return () => {
      active = false;
      clearTimer();
      subscription.remove();
    };
  }, [code, session, intervalMs]);
}
