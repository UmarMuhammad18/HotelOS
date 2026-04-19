import { useEffect, useRef } from 'react';
import { useHotelStore } from '../store/useHotelStore';
import { getFeedWsUrl } from '../config/env';

/**
 * Agent feed WebSocket with exponential backoff reconnection.
 */
export function useFeedWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { setConnected, incrementReconnect, resetReconnect, addEvent, setOfflineMode } = useHotelStore();
  const configVersion = useHotelStore((s) => s.configVersion);

  useEffect(() => {
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      const url = getFeedWsUrl();
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          resetReconnect();
          setConnected(true);
          setOfflineMode(false);
        };

        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data as string) as Record<string, unknown>;
            addEvent(data as never);
            if (data.type === 'status_change' && data.room && data.status) {
              useHotelStore.setState((s) => ({
                rooms: s.rooms.map((r) =>
                  r.number === String(data.room) ? { ...r, status: String(data.status) } : r
                ),
              }));
            }
          } catch {
            /* ignore parse errors */
          }
        };

        ws.onerror = () => {
          setConnected(false, 'WebSocket error');
        };

        ws.onclose = () => {
          setConnected(false);
          setOfflineMode(true);
          if (stopped) return;
          const attempts = useHotelStore.getState().reconnectAttempts;
          const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
          incrementReconnect();
          timerRef.current = setTimeout(connect, delay);
        };
      } catch (e) {
        setConnected(false, (e as Error).message);
        timerRef.current = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      stopped = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [addEvent, incrementReconnect, resetReconnect, setConnected, setOfflineMode, configVersion]);
}
