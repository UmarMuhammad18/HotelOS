import { useEffect, useRef, useCallback } from 'react';
import useWebSocketStore from '../stores/useWebSocketStore';
import { WS_URL } from '../config';

export function useWebSocketClient(url = WS_URL) {
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const {
    setConnected,
    setConnectionError,
    addEvent,
    incrementReconnectAttempts,
    resetReconnectAttempts,
    reconnectAttempts,
  } = useWebSocketStore();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        resetReconnectAttempts();
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          addEvent(data);
        } catch (err) {
          console.error('Failed to parse WebSocket message', err);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error', error);
        setConnectionError('WebSocket error occurred');
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setConnected(false);
        // Attempt reconnection with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        reconnectTimeoutRef.current = setTimeout(() => {
          incrementReconnectAttempts();
          connect();
        }, delay);
      };
    } catch (err) {
      setConnectionError(err.message);
    }
  }, [url, reconnectAttempts, setConnected, setConnectionError, addEvent, incrementReconnectAttempts, resetReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not open, cannot send message');
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { sendMessage };
}