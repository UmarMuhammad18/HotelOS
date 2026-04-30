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
    
    // Production on Render: Derive backend URL from frontend URL
    // Frontend: hotelos-jp70.onrender.com → Backend: https://hotelos-api.onrender.com
    // Or if separate: hotelos-frontend-xxx.onrender.com → https://hotelos-api-xxx.onrender.com
    if (hostname.includes('onrender.com')) {
      // Try to extract suffix from frontend URL
      const match = hostname.match(/^([^.]+)(-\w+)?\.onrender\.com$/);
      if (match) {
        const suffix = match[2] || ''; // e.g., '-jp70'
        return `https://hotelos-api${suffix}.onrender.com`;
      }
      // Fallback for direct backend URL
      return 'https://hotelos-api-backend.onrender.com';
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
