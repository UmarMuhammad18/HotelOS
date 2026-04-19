const api = (process.env.REACT_APP_API_URL || 'http://localhost:8080').replace(/\/$/, '');

/** REST API base (no trailing slash) */
export const API_BASE = api;

/** Agent feed WebSocket URL */
export const WS_URL =
  process.env.REACT_APP_WS_URL ||
  (api.startsWith('https') ? api.replace(/^https/, 'wss') : api.replace(/^http/, 'ws'));

/** Staff chat WebSocket */
export const CHAT_WS_URL = process.env.REACT_APP_CHAT_WS_URL || `${WS_URL}/chat`;
