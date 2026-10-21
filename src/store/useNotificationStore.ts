import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppNotification,
  NotificationPreferences,
  NotificationType,
} from '../types';
import {
  buildNotificationPayload,
  checkSystemPermission,
  DEFAULT_NOTIFICATION_PREFERENCES,
  getStoredPreferences,
  initializeNotificationService,
  NOTIFICATIONS_HISTORY_KEY,
  requestSystemPermission,
  saveStoredPreferences,
  sendSystemNotification,
} from '../services/notificationService';

export interface DispatchNotificationOptions {
  partyTitle?: string;
  partyId?: string;
  amount?: number;
  actorName?: string;
  customMessage?: string;
  data?: Record<string, any>;
  /** Force in-app toast even if category or master toggle is off (useful for previews/tests) */
  forceInApp?: boolean;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  activeInAppNotification: AppNotification | null;
  isInitialized: boolean;
  permissionStatus: 'granted' | 'denied' | 'undetermined';

  init: () => Promise<void>;
  refreshPermissionStatus: () => Promise<'granted' | 'denied' | 'undetermined'>;
  updatePreferences: (
    updater:
      | Partial<NotificationPreferences>
      | ((prev: NotificationPreferences) => NotificationPreferences)
  ) => Promise<void>;
  requestPermission: () => Promise<boolean>;
  dispatchNotification: (
    type: NotificationType,
    options?: DispatchNotificationOptions
  ) => Promise<AppNotification | null>;
  dismissInApp: () => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  activeInAppNotification: null,
  isInitialized: false,
  permissionStatus: 'undetermined',

  init: async () => {
    if (get().isInitialized) return;

    try {
      await initializeNotificationService();
      const prefs = await getStoredPreferences();
      let perm = await checkSystemPermission();

      // Mandatory permission check and prompt on app start/login:
      // If undetermined, prompt native OS permission dialog (Android 13+ POST_NOTIFICATIONS / iOS / Web)
      if (perm === 'undetermined') {
        const granted = await requestSystemPermission();
        perm = granted ? 'granted' : 'denied';
      }

      let history: AppNotification[] = [];
      try {
        const rawHistory = await AsyncStorage.getItem(NOTIFICATIONS_HISTORY_KEY);
        if (rawHistory) {
          const parsed = JSON.parse(rawHistory);
          if (Array.isArray(parsed)) {
            history = parsed;
          }
        }
      } catch (err) {
        console.warn('[NotificationStore] Failed to load notifications history:', err);
      }

      const unread = history.filter((n) => !n.read).length;

      set({
        preferences: prefs,
        notifications: history,
        unreadCount: unread,
        permissionStatus: perm,
        isInitialized: true,
      });
    } catch (err) {
      console.warn('[NotificationStore] Init error:', err);
      set({ isInitialized: true });
    }
  },

  refreshPermissionStatus: async () => {
    try {
      const perm = await checkSystemPermission();
      const currentPerm = get().permissionStatus;
      const currentPrefs = get().preferences;

      if (perm !== currentPerm || (perm === 'granted' && !currentPrefs.channels.system)) {
        const nextChannels = {
          ...currentPrefs.channels,
          system: perm === 'granted' ? true : currentPrefs.channels.system,
        };
        const nextPrefs = {
          ...currentPrefs,
          channels: nextChannels,
        };

        set({
          permissionStatus: perm,
          preferences: nextPrefs,
        });

        if (perm === 'granted') {
          await saveStoredPreferences(nextPrefs);
        }
      }
      return perm;
    } catch (err) {
      console.warn('[NotificationStore] refreshPermissionStatus error:', err);
      return get().permissionStatus;
    }
  },

  updatePreferences: async (updater) => {
    const current = get().preferences;
    const next: NotificationPreferences =
      typeof updater === 'function' ? updater(current) : { ...current, ...updater };

    set({ preferences: next });
    await saveStoredPreferences(next);
  },

  requestPermission: async () => {
    const granted = await requestSystemPermission();
    const status = granted ? 'granted' : 'denied';
    set((state) => ({
      permissionStatus: status,
      preferences: {
        ...state.preferences,
        channels: {
          ...state.preferences.channels,
          system: granted ? true : state.preferences.channels.system,
        },
      },
    }));
    await saveStoredPreferences(get().preferences);
    return granted;
  },

  dispatchNotification: async (type, options = {}) => {
    const { preferences } = get();

    // Check filtering conditions unless forced
    if (!options.forceInApp) {
      // 1. Global master toggle
      if (!preferences.enabled) {
        return null;
      }

      // 2. Category toggle
      if (!preferences.categories[type]) {
        return null;
      }
    }

    // Build payload
    const { title, message } = buildNotificationPayload(type, {
      partyTitle: options.partyTitle,
      partyId: options.partyId,
      amount: options.amount,
      actorName: options.actorName,
      customMessage: options.customMessage,
    });

    const newNotification: AppNotification = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      title,
      message,
      timestamp: Date.now(),
      read: false,
      partyId: options.partyId,
      partyTitle: options.partyTitle,
      amount: options.amount,
      actorName: options.actorName,
      data: options.data,
    };

    // Update notifications list (keep max 60 most recent)
    const updatedList = [newNotification, ...get().notifications].slice(0, 60);
    const unread = updatedList.filter((n) => !n.read).length;

    set({
      notifications: updatedList,
      unreadCount: unread,
    });

    // Save history in background
    AsyncStorage.setItem(NOTIFICATIONS_HISTORY_KEY, JSON.stringify(updatedList)).catch(
      (err) => console.warn('[NotificationStore] Save history error:', err)
    );

    // Channel 1: In-App toast
    if (preferences.channels.inApp || options.forceInApp) {
      set({ activeInAppNotification: newNotification });
    }

    // Channel 2: System shade push / local notification
    if (preferences.channels.system && !options.forceInApp) {
      sendSystemNotification(newNotification).catch((err) =>
        console.warn('[NotificationStore] System notification error:', err)
      );
    }

    return newNotification;
  },

  dismissInApp: () => {
    set({ activeInAppNotification: null });
  },

  markAsRead: async (id: string) => {
    const list = get().notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    const unread = list.filter((n) => !n.read).length;
    set({ notifications: list, unreadCount: unread });
    await AsyncStorage.setItem(NOTIFICATIONS_HISTORY_KEY, JSON.stringify(list));
  },

  markAllAsRead: async () => {
    const list = get().notifications.map((n) => ({ ...n, read: true }));
    set({ notifications: list, unreadCount: 0 });
    await AsyncStorage.setItem(NOTIFICATIONS_HISTORY_KEY, JSON.stringify(list));
  },

  deleteNotification: async (id: string) => {
    const list = get().notifications.filter((n) => n.id !== id);
    const unread = list.filter((n) => !n.read).length;
    set({ notifications: list, unreadCount: unread });
    await AsyncStorage.setItem(NOTIFICATIONS_HISTORY_KEY, JSON.stringify(list));
  },

  clearAll: async () => {
    set({ notifications: [], unreadCount: 0 });
    await AsyncStorage.removeItem(NOTIFICATIONS_HISTORY_KEY);
  },
}));
