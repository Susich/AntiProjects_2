import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  CURRENT_PARTY: '@partysplit:current_party_v2',
  PROFILES: '@partysplit:participant_profiles_v2',
  PARTY_HISTORY: '@partysplit:party_history_v2',
  CURRENT_USER_ID: '@partysplit:current_user_id',
  // Legacy keys for automatic migration
  LEGACY_CURRENT_PARTY: '@partysplit:current_party',
  LEGACY_SAVED_FRIENDS: '@partysplit:saved_friends',
  LEGACY_PAYMENT_PROFILE: '@partysplit:payment_profile',
};

export async function saveItem<T>(key: string, data: T): Promise<void> {
  try {
    const json = JSON.stringify(data);
    await AsyncStorage.setItem(key, json);
  } catch (error) {
    console.warn(`[AsyncStorage] Failed to save key "${key}":`, error);
  }
}

export async function loadItem<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const json = await AsyncStorage.getItem(key);
    if (json !== null) {
      return JSON.parse(json) as T;
    }
  } catch (error) {
    console.warn(`[AsyncStorage] Failed to load key "${key}":`, error);
  }
  return defaultValue;
}

export { STORAGE_KEYS };
