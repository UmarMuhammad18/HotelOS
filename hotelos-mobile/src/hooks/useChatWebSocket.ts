import { useCallback, useEffect, useRef, useState } from 'react';
import { getChatWsUrl } from '../config/env';
import { useHotelStore } from '../store/useHotelStore';

export type ChatBubble = {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
};

export function useChatWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const configVersion = useHotelStore((s) => s.configVersion);

  useEffect(() => {
    const ws = new WebSocket(getChatWsUrl());
    wsRef.current = ws;
    ws.onopen = () => {
      setConnected(true);
      setMessages((m) => [
        ...m,
        {
          id: 'sys',
          text: 'Connected to HotelOS assistant.',
          isUser: false,
          timestamp: new Date().toISOString(),
        },
      ]);
    };
    ws.onclose = () => setConnected(false);
    ws.onmessage = (ev) => {
      setTyping(false);
      try {
        const data = JSON.parse(ev.data as string) as { message?: string };
        setMessages((m) => [
          ...m,
          {
            id: String(Date.now()),
            text: data.message || 'OK.',
            isUser: false,
            timestamp: new Date().toISOString(),
          },
        ]);
      } catch {
        /* */
      }
    };
    return () => ws.close();
  }, [configVersion]);

  const send = useCallback((text: string) => {
    if (!text.trim() || wsRef.current?.readyState !== WebSocket.OPEN) return;
    setTyping(true);
    setMessages((m) => [
      ...m,
      {
        id: `u-${Date.now()}`,
        text,
        isUser: true,
        timestamp: new Date().toISOString(),
      },
    ]);
    wsRef.current.send(
      JSON.stringify({
        type: 'chat',
        message: text,
        timestamp: new Date().toISOString(),
      })
    );
  }, []);

  return { connected, typing, messages, send };
}
