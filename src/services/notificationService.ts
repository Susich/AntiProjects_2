import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  AndroidImportance,
  AndroidNotificationVisibility,
} from 'expo-notifications';
import { AppNotification, NotificationPreferences, NotificationType } from '../types';

export const NOTIFICATION_PREFS_KEY = '@partysplit:notification_preferences';
export const NOTIFICATIONS_HISTORY_KEY = '@partysplit:notifications_history';
export const ANDROID_NOTIFICATION_CHANNEL_ID = 'bill-operations';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  channels: {
    system: false,
    inApp: true,
  },
  categories: {
    party_invite: true,
    bill_change: true,
    payment_status: true,
    debt_reminder: true,
    party_closed: true,
  },
};

// Configure native notification presentation behavior:
// Show OS system alert shade, heads-up banner and play sound.
if (Platform.OS !== 'web') {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (err) {
    console.warn('[NotificationService] setNotificationHandler warning:', err);
  }
}

/**
 * Initializes notification channels on Android and verifies permissions.
 */
export async function initializeNotificationService(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(ANDROID_NOTIFICATION_CHANNEL_ID, {
        name: 'Операции по счетам',
        description: 'Уведомления о переводах, изменении чека и закрытии счетов (Heads-up)',
        importance: AndroidImportance.MAX,
        lightColor: '#00F5A0',
        enableLights: true,
        enableVibrate: true,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
        showBadge: true,
        lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
      });

      // Also ensure default fallback channel exists with high importance
      await Notifications.setNotificationChannelAsync('default', {
        name: 'PartySplit',
        description: 'Основной канал оповещений PartySplit',
        importance: AndroidImportance.MAX,
        lightColor: '#00F5A0',
        enableLights: true,
        enableVibrate: true,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
        showBadge: true,
        lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
      });
    } catch (err) {
      console.warn('[NotificationService] Android channel setup warning:', err);
    }
  }
}

/**
 * Retrieves persisted notification preferences from AsyncStorage.
 */
export async function getStoredPreferences(): Promise<NotificationPreferences> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      enabled: parsed.enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.enabled,
      channels: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.channels,
        ...(parsed.channels || {}),
      },
      categories: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.categories,
        ...(parsed.categories || {}),
      },
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

/**
 * Persists notification preferences to AsyncStorage.
 */
export async function saveStoredPreferences(
  prefs: NotificationPreferences
): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.warn('[NotificationService] Failed to save preferences:', err);
  }
}

/**
 * Checks system notification permission status across Web and Native.
 */
export async function checkSystemPermission(): Promise<
  'granted' | 'denied' | 'undetermined'
> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    const perm = window.Notification.permission;
    if (perm === 'granted') return 'granted';
    if (perm === 'denied') return 'denied';
    return 'undetermined';
  }

  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    return 'undetermined';
  }
}

/**
 * Requests system notification permission from the OS / browser.
 */
export async function requestSystemPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    try {
      const res = await window.Notification.requestPermission();
      return res === 'granted';
    } catch {
      return false;
    }
  }

  try {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    return status === 'granted';
  } catch (err) {
    console.warn('[NotificationService] Native permission request error:', err);
    return false;
  }
}

/**
 * Dispatches a notification. Phone system shade notifications have been removed
 * per user request; notifications are maintained exclusively within the in-app
 * notification center.
 */
export async function sendSystemNotification(
  _notification: AppNotification
): Promise<void> {
  // No-op: OS push notifications to phone shade removed.
}

/**
 * Checks if the app was launched from a killed state by tapping a notification.
 */
export async function getInitialNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  if (Platform.OS === 'web') return null;
  try {
    return await Notifications.getLastNotificationResponseAsync();
  } catch (err) {
    console.warn('[NotificationService] Failed to get initial notification response:', err);
    return null;
  }
}

/**
 * Opens system device settings for PartySplit so user can enable notifications.
 */
export async function openSystemNotificationSettings(): Promise<void> {
  try {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      await Linking.openSettings();
    }
  } catch (err) {
    console.warn('[NotificationService] Could not open app settings:', err);
  }
}

/**
 * Opens battery optimization settings on Android to ensure notifications
 * are delivered even when app is killed or inactive.
 */
export async function openBatteryOptimizationSettings(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      const IntentLauncher = await import('expo-intent-launcher');
      await IntentLauncher.startActivityAsync(
        'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
      );
      return;
    } catch {
      // Fall back to general app settings
    }
  }
  await openSystemNotificationSettings();
}

/**
 * Subscribes to tap events on system notifications when user clicks from tray.
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): () => void {
  if (Platform.OS === 'web') {
    return () => {};
  }
  try {
    const sub = Notifications.addNotificationResponseReceivedListener(callback);
    return () => {
      sub.remove();
    };
  } catch (err) {
    console.warn('[NotificationService] Response listener warning:', err);
    return () => {};
  }
}

/**
 * Helper to build notification templates per domain requirements.
 */
export function buildNotificationPayload(
  type: NotificationType,
  params: {
    partyTitle?: string;
    partyId?: string;
    amount?: number;
    actorName?: string;
    customMessage?: string;
  }
): { title: string; message: string } {
  const party = params.partyTitle ? `«${params.partyTitle}»` : 'тусе';
  const amountStr = params.amount != null ? `${Math.round(params.amount)} ₽` : '';

  switch (type) {
    case 'party_invite':
      return {
        title: 'Включение в счёт',
        message: params.amount
          ? `Вас включили в счёт по тусе ${party} — ваша доля: ${amountStr}`
          : `Вас добавили в общую комнату по тусе ${party}`,
      };

    case 'bill_change':
      return {
        title: 'Изменение состава чека',
        message: params.amount
          ? `В счёте ${party} изменились позиции. Ваша новая сумма: ${amountStr}`
          : `В счёте ${party} обновлены позиции и участники`,
      };

    case 'payment_status':
      return {
        title: 'Оплата доли',
        message: params.actorName
          ? `${params.actorName} оплатил(а) свою долю${amountStr ? ` (${amountStr})` : ''}`
          : `Один из участников оплатил свою долю${amountStr ? ` (${amountStr})` : ''}`,
      };

    case 'debt_reminder':
      return {
        title: 'Напоминание о долге',
        message: `Напоминание: ожидается оплата по счёту ${party}${amountStr ? ` (${amountStr})` : ''}`,
      };

    case 'party_closed':
      return {
        title: 'Сбор завершён',
        message: `Счёт по тусе ${party} полностью закрыт и сохранён в архив`,
      };

    default:
      return {
        title: 'PartySplit',
        message: params.customMessage || 'Новое событие в комнате',
      };
  }
}
