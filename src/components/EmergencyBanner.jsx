import { useMemo } from 'react';
import useWebSocketStore from '../stores/useWebSocketStore';

/**
 * Sticky strip when live feed contains emergency / high-severity events.
 */
export default function EmergencyBanner() {
  const events = useWebSocketStore((s) => s.events || s.feed || []);
  const tasks = useWebSocketStore((s) => s.tasks || []);

  const active = useMemo(() => {
    const fromEvents = (Array.isArray(events) ? events : [])
      .filter((e) => {
        const p = (e.priority || e.type || '').toString().toLowerCase();
        const msg = (e.message || e.details || '').toString().toLowerCase();
        return p === 'emergency' || p.includes('emergency') || msg.includes('emergency') || e.emergency;
      })
      .slice(0, 3);
    const fromTasks = (Array.isArray(tasks) ? tasks : [])
      .filter((t) => (t.priority || '').toLowerCase() === 'emergency' && t.status !== 'completed')
      .slice(0, 3);
    return { fromEvents, fromTasks };
  }, [events, tasks]);

  const count = active.fromEvents.length + active.fromTasks.length;
  if (!count) return null;

  const label =
    active.fromTasks[0]?.title ||
    active.fromEvents[0]?.message ||
    active.fromEvents[0]?.details ||
    'Active emergency';

  return (
    <div
      role="alert"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'linear-gradient(90deg, rgba(239,68,68,0.95), rgba(185,28,28,0.95))',
        color: '#fff',
        padding: '10px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        fontSize: 13,
        fontWeight: 600,
        boxShadow: '0 4px 24px rgba(239,68,68,0.35)',
      }}
    >
      <span>
        🚨 {count} active emergency signal{count > 1 ? 's' : ''} — {label}
      </span>
      <a
        href="/dashboard/tasks"
        style={{ color: '#fff', textDecoration: 'underline', fontSize: 12, whiteSpace: 'nowrap' }}
      >
        Open task board →
      </a>
    </div>
  );
}
