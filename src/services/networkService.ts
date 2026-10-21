import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface NetworkState {
  isOnline: boolean;
  isInternetReachable: boolean;
  isSyncing: boolean;
  lastSyncAt: number | null;
  pendingCount: number;
}

type NetworkListener = (state: NetworkState) => void;

let currentState: NetworkState = {
  isOnline: true,
  isInternetReachable: true,
  isSyncing: false,
  lastSyncAt: null,
  pendingCount: 0,
};

const listeners = new Set<NetworkListener>();
let isInitialized = false;
let onReconnectHandler: (() => Promise<void> | void) | null = null;

function notifyListeners(): void {
  const snapshot = { ...currentState };
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (err) {
      console.warn('[NetworkService] Listener error:', err);
    }
  });
}

function handleStateChange(isOnline: boolean, isReachable: boolean): void {
  const wasOffline = !currentState.isOnline;
  const changed =
    currentState.isOnline !== isOnline ||
    currentState.isInternetReachable !== isReachable;

  currentState = {
    ...currentState,
    isOnline,
    isInternetReachable: isReachable,
  };

  if (changed) {
    notifyListeners();
  }

  // Trigger reconnect handler when coming back online
  if (wasOffline && isOnline && onReconnectHandler) {
    try {
      void onReconnectHandler();
    } catch (err) {
      console.warn('[NetworkService] Reconnect handler error:', err);
    }
  }
}

/**
 * Initializes network listeners for Web and Native.
 */
export function initializeNetworkService(options?: {
  onReconnect?: () => Promise<void> | void;
}): () => void {
  if (options?.onReconnect) {
    onReconnectHandler = options.onReconnect;
  }

  if (isInitialized) {
    return () => {};
  }
  isInitialized = true;

  // Web window events
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const handleWebOnline = () => handleStateChange(true, true);
    const handleWebOffline = () => handleStateChange(false, false);

    window.addEventListener('online', handleWebOnline);
    window.addEventListener('offline', handleWebOffline);

    currentState.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    currentState.isInternetReachable = currentState.isOnline;
  }

  // Universal NetInfo listener (Android, iOS, Web)
  const unsubscribeNetInfo = NetInfo.addEventListener((netState: NetInfoState) => {
    const isConnected = Boolean(netState.isConnected);
    // isInternetReachable can be null while undetermined; treat as connected if isConnected is true
    const isReachable = netState.isInternetReachable ?? isConnected;
    handleStateChange(isConnected && isReachable, isReachable);
  });

  // Initial fetch
  NetInfo.fetch().then((netState) => {
    const isConnected = Boolean(netState.isConnected);
    const isReachable = netState.isInternetReachable ?? isConnected;
    handleStateChange(isConnected && isReachable, isReachable);
  }).catch(() => {
    // If netinfo fetch fails, default to optimistic online
  });

  return () => {
    unsubscribeNetInfo();
  };
}

/**
 * Updates syncing status and notifies listeners (for UI progress bars).
 */
export function setNetworkSyncingStatus(
  isSyncing: boolean,
  lastSyncAt?: number
): void {
  currentState = {
    ...currentState,
    isSyncing,
    lastSyncAt: lastSyncAt !== undefined ? lastSyncAt : currentState.lastSyncAt,
  };
  notifyListeners();
}

/**
 * Updates count of pending offline mutations for UI badges.
 */
export function setPendingMutationsCount(count: number): void {
  if (currentState.pendingCount === count) return;
  currentState = {
    ...currentState,
    pendingCount: count,
  };
  notifyListeners();
}

/**
 * Returns current synchronous online flag.
 */
export function isNetworkOnline(): boolean {
  return currentState.isOnline;
}

/**
 * Returns current snapshot of network state.
 */
export function getNetworkState(): NetworkState {
  return { ...currentState };
}

/**
 * Registers a callback whenever network state, syncing, or pending count changes.
 */
export function addNetworkListener(listener: NetworkListener): () => void {
  listeners.add(listener);
  listener({ ...currentState });
  return () => {
    listeners.delete(listener);
  };
}

/**
 * React hook for consuming network and sync state in components.
 */
export function useNetworkStatus(): NetworkState {
  const [state, setState] = useState<NetworkState>(() => ({ ...currentState }));

  useEffect(() => {
    const unsubscribe = addNetworkListener(setState);
    return unsubscribe;
  }, []);

  return state;
}
