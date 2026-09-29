import Constants from 'expo-constants';

/**
 * Gateway URL from the environment (EXPO_PUBLIC_API_URL), never hard-coded.
 * On a physical phone use the machine's LAN IP, not localhost.
 */
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  'http://localhost:8080';
