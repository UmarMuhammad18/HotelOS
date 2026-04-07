import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useWebSocketStore from '../stores/useWebSocketStore';

export default function EventAnimationTrigger() {
  const { lastEvent } = useWebSocketStore();
  const prevEventRef = useRef(null);

  // Only trigger if new event is different from previous
  const shouldAnimate = lastEvent && lastEvent.id !== prevEventRef.current?.id;

  useEffect(() => {
    if (lastEvent) {
      prevEventRef.current = lastEvent;
    }
  }, [lastEvent]);

  return (
    <AnimatePresence>
      {shouldAnimate && (
        <motion.div
          key={lastEvent.id}
          initial={{ opacity: 0, scale: 0.8, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.4, type: 'spring' }}
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            background: '#f5a623',
            color: '#090b0f',
            padding: '8px 16px',
            borderRadius: 8,
            fontFamily: "'Space Mono', monospace",
            fontSize: 12,
            zIndex: 1000,
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          🔔 New Event: {lastEvent.type || 'update'}
        </motion.div>
      )}
    </AnimatePresence>
  );
}