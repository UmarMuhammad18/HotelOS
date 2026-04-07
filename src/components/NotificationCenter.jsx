import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useWebSocketStore from '../stores/useWebSocketStore';

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead } = useWebSocketStore();
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (type) => {
    switch (type) {
      case 'alert': return '⚠️';
      case 'decision': return '🤖';
      default: return '📢';
    }
  };

  const getColor = (type) => {
    switch (type) {
      case 'alert': return '#f87171';
      case 'decision': return '#f5a623';
      default: return '#60a5fa';
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'transparent',
          border: 'none',
          fontSize: 20,
          cursor: 'pointer',
          position: 'relative',
          padding: '8px',
          borderRadius: 8,
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#1c2230'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 0,
            right: 0,
            background: '#f87171',
            color: 'white',
            fontSize: 10,
            borderRadius: '50%',
            width: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>{unreadCount}</span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            style={{
              position: 'absolute',
              right: 0,
              top: 40,
              width: 320,
              background: '#0e1117',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12,
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              zIndex: 1000,
              overflow: 'hidden',
            }}
          >
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: '#f5a623' }}>NOTIFICATIONS</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllNotificationsRead}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: 10,
                    color: '#8892a4',
                    cursor: 'pointer',
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#4e5a6e' }}>No notifications</div>
              ) : (
                notifications.map(notif => (
                  <div
                    key={notif.id}
                    onClick={() => markNotificationRead(notif.id)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      background: notif.read ? 'transparent' : 'rgba(245,166,35,0.05)',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ fontSize: 16 }}>{getIcon(notif.type)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: '#e8eaf0', marginBottom: 2 }}>{notif.title}</div>
                        <div style={{ fontSize: 11, color: '#8892a4' }}>{notif.message}</div>
                        <div style={{ fontSize: 9, color: '#4e5a6e', marginTop: 4 }}>
                          {new Date(notif.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                      {!notif.read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: getColor(notif.type), marginTop: 6 }} />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}