import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebSocket } from '../hooks/useWebSocket';

// Color mapping for action types
const typeConfig = {
  thought: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', label: 'THOUGHT' },
  decision: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', label: 'DECISION' },
  execution: { color: '#f5a623', bg: 'rgba(245,166,35,0.12)', label: 'EXECUTION' },
  alert: { color: '#f87171', bg: 'rgba(248,113,113,0.12)', label: 'ALERT' },
  success: { color: '#4ade80', bg: 'rgba(74,222,128,0.12)', label: 'SUCCESS' },
};

// Single feed item with animation
function FeedItem({ item, index }) {
  const config = typeConfig[item.type] || typeConfig.execution;
  const timestamp = item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3, delay: index * 0.02 }}
      style={{
        background: '#0e1117',
        borderLeft: `3px solid ${config.color}`,
        borderRadius: 8,
        padding: '12px 16px',
        marginBottom: 8,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      {/* Type badge */}
      <div style={{
        background: config.bg,
        color: config.color,
        fontSize: 10,
        fontFamily: "'Space Mono', monospace",
        padding: '2px 8px',
        borderRadius: 4,
        fontWeight: 700,
        letterSpacing: '0.05em',
        whiteSpace: 'nowrap',
      }}>
        {config.label}
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: config.color }}>
            [{item.agent || 'Unknown Agent'}]
          </span>
          <span style={{ fontSize: 12, color: '#e8eaf0' }}>{item.message}</span>
        </div>
        {item.details && (
          <div style={{ fontSize: 11, color: '#8892a4', marginTop: 4 }}>
            {item.details}
          </div>
        )}
      </div>

      {/* Timestamp */}
      <div style={{
        fontSize: 10,
        fontFamily: "'Space Mono', monospace",
        color: '#4e5a6e',
        whiteSpace: 'nowrap',
      }}>
        {timestamp}
      </div>
    </motion.div>
  );
}

export default function ActivityFeed({ wsUrl = 'ws://localhost:8080' }) {
  const [events, setEvents] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const feedRef = useRef(null);
  const { messages, isConnected } = useWebSocket(wsUrl);

  // Append incoming WebSocket messages to events array
  useEffect(() => {
    if (messages.length > 0) {
      const newEvent = messages[messages.length - 1];
      setEvents(prev => [...prev, newEvent]);
    }
  }, [messages]);

  // Auto-scroll to bottom when new events arrive (if autoScroll enabled)
  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  // Detect manual scroll to disable auto-scroll temporarily
  const handleScroll = () => {
    if (!feedRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
    setAutoScroll(isAtBottom);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header with connection status */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: '#0c0f16',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: '#f5a623' }}>
            AGENT ACTIVITY FEED
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isConnected ? '#4ade80' : '#f87171',
              boxShadow: isConnected ? '0 0 6px #4ade80' : 'none',
            }} />
            <span style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: '#8892a4' }}>
              {isConnected ? 'LIVE' : 'DISCONNECTED'}
            </span>
          </div>
        </div>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 10,
            fontFamily: "'Space Mono', monospace",
            color: autoScroll ? '#2dd4bf' : '#8892a4',
            cursor: 'pointer',
          }}
        >
          {autoScroll ? '🔽 Auto-scroll ON' : '⏸️ Auto-scroll OFF'}
        </button>
      </div>

      {/* Feed list */}
      <div
        ref={feedRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          scrollBehavior: 'smooth',
        }}
      >
        <AnimatePresence>
          {events.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#4e5a6e' }}>
              Waiting for agent events...
            </div>
          )}
          {events.map((event, idx) => (
            <FeedItem key={idx} item={event} index={idx} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}