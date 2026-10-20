import { useEffect } from 'react';
import { AppState } from 'react-native';
import { usePartyStore } from '../store/usePartyStore';

/**
 * How often the app pulls fresh room data from Google Sheets while the user
 * is on any screen of the app. Google Apps Script has no push channel, so
 * polling is the "real-time" mechanism: new expenses and participants from
 * other devices appear within ~10 seconds.
 */
const DEFAULT_INTERVAL_MS = 10000;

export function useCloudAutoSync(intervalMs: number = DEFAULT_INTERVAL_MS): void {
  const code = usePartyStore((s) => s.currentParty.code);
  const syncWithCloud = usePartyStore((s) => s.syncWithCloud);

  useEffect(() => {
    if (!code) return;

    let active = true;
    let inFlight = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const sync = async () => {
      if (!active || inFlight) return;
      // The room could have been reset/left while the request was queued.
      if (!usePartyStore.getState().currentParty.code) return;
      inFlight = true;
      try {
        await syncWithCloud();
      } finally {
        inFlight = false;
      }
    };

    const start = () => {
      if (timer) return;
      void sync();
      timer = setInterval(() => {
        void sync();
      }, intervalMs);
    };

    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    start();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        start();
      } else {
        stop();
      }
    });

    return () => {
      active = false;
      stop();
      subscription.remove();
    };
  }, [code, intervalMs, syncWithCloud]);
}
