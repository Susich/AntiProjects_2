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
 *  - pauses in the background and refreshes immediately on foreground;
 *  - uses the API read cache / in-flight deduplication.
 */
const DEFAULT_INTERVAL_MS = 8000;
const MAX_INTERVAL_MS = 60000;

export function useCloudAutoSync(intervalMs: number = DEFAULT_INTERVAL_MS): void {
  const code = usePartyStore((s) => s.currentParty.code);
  const session = usePartyStore((s) => s.session);

  useEffect(() => {
    if (!code || !session) return;

    let active = true;
    let paused = false;
    let running = false;
    let nextDelay = intervalMs;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const schedule = (delay: number) => {
      if (!active || paused) return;
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        void sync();
      }, delay);
    };

    const sync = async () => {
      if (!active || paused || running) return;

      if (!isNetworkOnline()) {
        schedule(Math.max(intervalMs, 10000));
        return;
      }

      const state = usePartyStore.getState();
      if (!state.currentParty.code || !state.session) return;

      // A poll during an optimistic write would fetch the pre-write sheet and
      // briefly revert the UI. Wait for the queue instead.
      if (hasPendingCloudWrites()) {
        schedule(Math.min(intervalMs, 2500));
        return;
      }

      running = true;
      let success = false;
      try {
        const result = await state.syncWithCloud({ background: true });
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
        schedule(nextDelay + Math.floor(Math.random() * 600));
      }
    };

    // On mount: revalidate now. Cached data is already visible from hydrate().
    schedule(0);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        paused = false;
        nextDelay = intervalMs;
        schedule(0);
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
