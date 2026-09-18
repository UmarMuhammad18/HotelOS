import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import useWebSocketStore from '../stores/useWebSocketStore';

const COLUMNS = [
  { id: 'pending', label: 'Pending', statuses: ['pending', 'open', 'new'] },
  { id: 'assigned', label: 'Assigned', statuses: ['assigned'] },
  { id: 'in-progress', label: 'In progress', statuses: ['in-progress', 'in_progress', 'active'] },
  { id: 'completed', label: 'Done', statuses: ['completed', 'done', 'resolved'] },
];

const priorityColor = {
  emergency: '#ef4444',
  urgent: '#f97316',
  high: '#eab308',
  normal: '#8892a4',
  low: '#64748b',
};

function normalizeStatus(s) {
  return (s || 'pending').toLowerCase().replace('_', '-');
}

function TaskCard({ task, onStatusUpdate, onAssign }) {
  const pri = (task.priority || 'normal').toLowerCase();
  const color = priorityColor[pri] || priorityColor.normal;
  return (
    <motion.div
      layout
      className="ho-card"
      style={{ padding: 14, marginBottom: 10, borderLeft: `3px solid ${color}` }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <strong style={{ fontSize: 14 }}>{task.title || task.summary || 'Task'}</strong>
        <span className="ho-badge" style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
          {pri}
        </span>
      </div>
      <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--ho-text-muted)' }}>
        {task.description || task.details || ''}
      </p>
      {(task.department || task.room) && (
        <div style={{ fontSize: 11, color: 'var(--ho-text-muted)', marginBottom: 10, fontFamily: 'var(--ho-mono)' }}>
          {[task.department, task.room ? `Room ${task.room}` : null].filter(Boolean).join(' · ')}
        </div>
      )}
      {task.repeatIssue && <span className="ho-badge ho-badge-triage" style={{ marginBottom: 8 }}>Repeat issue</span>}
      {task.needsHumanTriage && <span className="ho-badge ho-badge-triage" style={{ marginBottom: 8 }}>Human triage</span>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <select
          value={task.assignedTo || ''}
          onChange={(e) => onAssign?.(task.id, e.target.value)}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--ho-border)',
            borderRadius: 8,
            color: 'var(--ho-text)',
            padding: '8px 10px',
            fontSize: 12,
          }}
        >
          <option value="">Unassigned</option>
          <option value="John">John (Housekeeping)</option>
          <option value="Sarah">Sarah (Maintenance)</option>
          <option value="Mike">Mike (Front Desk)</option>
          <option value="AI Agent">AI Agent</option>
        </select>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {COLUMNS.filter((c) => !c.statuses.includes(normalizeStatus(task.status))).map((c) => (
            <button
              key={c.id}
              className="ho-btn-ghost"
              style={{ padding: '6px 10px', fontSize: 11 }}
              onClick={() => onStatusUpdate?.(task.id, c.statuses[0])}
            >
              → {c.label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function TaskBoard() {
  const { tasks = [], updateTaskStatus, assignTask } = useWebSocketStore();
  const [dept, setDept] = useState('all');
  const [priority, setPriority] = useState('all');

  const filtered = useMemo(() => {
    return (tasks || []).filter((t) => {
      if (dept !== 'all' && (t.department || '').toLowerCase() !== dept) return false;
      if (priority !== 'all' && (t.priority || 'normal').toLowerCase() !== priority) return false;
      return true;
    });
  }, [tasks, dept, priority]);

  const byColumn = useMemo(() => {
    const map = Object.fromEntries(COLUMNS.map((c) => [c.id, []]));
    for (const t of filtered) {
      const st = normalizeStatus(t.status);
      const col = COLUMNS.find((c) => c.statuses.includes(st)) || COLUMNS[0];
      map[col.id].push(t);
    }
    return map;
  }, [filtered]);

  const departments = useMemo(() => {
    const set = new Set((tasks || []).map((t) => (t.department || '').toLowerCase()).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [tasks]);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 24 }}>Task board</h1>
        <p style={{ margin: 0, color: 'var(--ho-text-muted)', fontSize: 14 }}>
          Lifecycle: pending → assigned → in progress → done
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <select
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          style={{
            background: 'var(--ho-bg-card)',
            color: 'var(--ho-text)',
            border: '1px solid var(--ho-border)',
            borderRadius: 8,
            padding: '8px 12px',
          }}
        >
          {departments.map((d) => (
            <option key={d} value={d}>
              {d === 'all' ? 'All departments' : d}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          style={{
            background: 'var(--ho-bg-card)',
            color: 'var(--ho-text)',
            border: '1px solid var(--ho-border)',
            borderRadius: 8,
            padding: '8px 12px',
          }}
        >
          <option value="all">All priorities</option>
          <option value="emergency">Emergency</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(200px, 1fr))',
          gap: 12,
          overflowX: 'auto',
        }}
      >
        {COLUMNS.map((col) => (
          <div key={col.id} style={{ minWidth: 200 }}>
            <div
              style={{
                fontFamily: 'var(--ho-mono)',
                fontSize: 11,
                color: 'var(--ho-text-muted)',
                marginBottom: 10,
                letterSpacing: '0.06em',
              }}
            >
              {col.label.toUpperCase()} · {byColumn[col.id].length}
            </div>
            {byColumn[col.id].map((t) => (
              <TaskCard
                key={t.id || t.title}
                task={t}
                onStatusUpdate={updateTaskStatus}
                onAssign={assignTask}
              />
            ))}
            {!byColumn[col.id].length && (
              <div style={{ color: 'var(--ho-text-muted)', fontSize: 12, padding: 12 }}>No tasks</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
