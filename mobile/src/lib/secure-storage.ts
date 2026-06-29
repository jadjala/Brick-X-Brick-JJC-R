import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Supabase storage adapter backed by Expo SecureStore on native. On web (used
// only for the verification harness) SecureStore is unavailable, so fall back to
// localStorage. SecureStore keys must be alphanumeric/._- so we sanitize.
const safeKey = (key: string) => key.replace(/[^a-zA-Z0-9._-]/g, '_');

export const ExpoSecureStorage = {
  getItem: (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') return Promise.resolve(globalThis.localStorage?.getItem(key) ?? null);
    return SecureStore.getItemAsync(safeKey(key));
  },
  setItem: (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(key, value);
      return Promise.resolve();
    }
    return SecureStore.setItemAsync(safeKey(key), value);
  },
  removeItem: (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(key);
      return Promise.resolve();
    }
    return SecureStore.deleteItemAsync(safeKey(key));
  },
};
