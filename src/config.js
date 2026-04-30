// Determine API URL based on environment
const getApiUrl = () => {
  // Check if explicitly set via environment variable (highest priority)
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // In browser environment
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Development: localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8080';
    }
    
    // Production on Render: the API service in render.yml is named hotelos-api.
    if (hostname.includes('onrender.com')) {
      return 'https://hotelos-api.onrender.com';
    }
  }
  
  // Default fallback to localhost for SSR/tests
  return 'http://localhost:8080';
};

const api = getApiUrl().replace(/\/$/, '');

/** REST API base (no trailing slash) */
export const API_BASE = api;

/** Agent feed WebSocket URL */
export const WS_URL =
  process.env.REACT_APP_WS_URL ||
  (api.startsWith('https') ? api.replace(/^https/, 'wss') : api.replace(/^http/, 'ws'));

/** Staff chat WebSocket */
export const CHAT_WS_URL = process.env.REACT_APP_CHAT_WS_URL || `${WS_URL}/chat`;
