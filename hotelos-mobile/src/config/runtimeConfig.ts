import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'HOTELOS_API_BASE';

let apiBase = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080').replace(/\/$/, '');

export function getApiBase(): string {
  return apiBase;
}

export async function loadSavedApiBase(): Promise<void> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v) apiBase = v.replace(/\/$/, '');
  } catch {
    /* */
  }
}

export async function saveApiBase(url: string): Promise<void> {
  apiBase = url.trim().replace(/\/$/, '');
  await AsyncStorage.setItem(KEY, apiBase);
}
