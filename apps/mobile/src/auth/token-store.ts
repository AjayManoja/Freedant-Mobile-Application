import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'feedants.session';

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
}

/**
 * US-03: tokens live only in the device's secure storage (Keystore on Android). The web
 * export is a demo; it falls back to localStorage, which is documented as such.
 */
export const tokenStore = {
  async load(): Promise<StoredSession | null> {
    const raw =
      Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredSession;
    } catch {
      return null;
    }
  },
  async save(s: StoredSession): Promise<void> {
    const raw = JSON.stringify(s);
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, raw);
    else await SecureStore.setItemAsync(KEY, raw);
  },
  async clear(): Promise<void> {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  },
};
