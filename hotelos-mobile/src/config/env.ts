import Constants from 'expo-constants';
import { getApiBase } from './runtimeConfig';

/** HTTP API base, no trailing slash */
export function API_BASE(): string {
  const fromExtra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  if (fromExtra) return fromExtra.replace(/\/$/, '');
  return getApiBase();
}

export function getFeedWsUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_WS_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const api = API_BASE();
  if (api.startsWith('https')) return api.replace(/^https/, 'wss');
  return api.replace(/^http/, 'ws');
}

export function getChatWsUrl(): string {
  return `${getFeedWsUrl()}/chat`;
}
