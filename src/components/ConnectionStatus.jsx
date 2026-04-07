import { motion } from 'framer-motion';
import useWebSocketStore from '../stores/useWebSocketStore';

export default function ConnectionStatus() {
  const { isConnected, connectionError } = useWebSocketStore();

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: '#0e1117',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 20,
        padding: '4px 12px',
        fontSize: 11,
        fontFamily: "'Space Mono', monospace",
      }}
    >
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: isConnected ? '#4ade80' : connectionError ? '#f87171' : '#f5a623',
        boxShadow: isConnected ? '0 0 6px #4ade80' : 'none',
        animation: isConnected ? 'pulse 1.5s infinite' : 'none',
      }} />
      <span style={{ color: '#8892a4' }}>
        {isConnected ? 'LIVE' : connectionError ? 'ERROR' : 'CONNECTING...'}
      </span>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </motion.div>
  );
}