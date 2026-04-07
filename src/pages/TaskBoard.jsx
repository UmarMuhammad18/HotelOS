import { useState } from 'react';
import { motion } from 'framer-motion';
import useWebSocketStore from '../stores/useWebSocketStore';

function TaskCard({ task, onAssign, onStatusUpdate }) {
  const statusColors = {
    pending: '#f5a623',
    'in-progress': '#60a5fa',
    completed: '#4ade80',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: '#0e1117',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12,
        padding: '16px',
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>{task.title}</div>
        <div style={{
          fontSize: 10,
          fontFamily: "'Space Mono', monospace",
          padding: '2px 8px',
          borderRadius: 4,
          background: `${statusColors[task.status]}20`,
          color: statusColors[task.status],
        }}>
          {task.status.toUpperCase()}
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#8892a4', marginBottom: 12 }}>{task.description}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select
          value={task.assignedTo || ''}
          onChange={(e) => onAssign(task.id, e.target.value)}
          style={{
            background: '#0c0f16',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 11,
            color: '#e8eaf0',
          }}
        >
          <option value="">Assign to...</option>
          <option value="John">John (Housekeeping)</option>
          <option value="Sarah">Sarah (Maintenance)</option>
          <option value="Mike">Mike (Front Desk)</option>
        </select>
        {task.status !== 'completed' && (
          <button
            onClick={() => onStatusUpdate(task.id, 'completed')}
            style={{
              background: '#4ade8020',
              border: '1px solid #4ade8080',
              borderRadius: 6,
              padding: '4px 12px',
              fontSize: 10,
              color: '#4ade80',
              cursor: 'pointer',
            }}
          >
            Complete
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default function TaskBoard() {
  const { tasks, updateTaskStatus, assignTask } = useWebSocketStore();
  const [filter, setFilter] = useState('all');

  const filteredTasks = tasks.filter(t => filter === 'all' ? true : t.status === filter);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontFamily: "'Space Mono', monospace", color: '#e8eaf0', marginBottom: 20 }}>
        Task Board
      </h1>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {['all', 'pending', 'in-progress', 'completed'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? '#f5a62320' : 'transparent',
              border: `1px solid ${filter === f ? '#f5a623' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 20,
              padding: '6px 16px',
              fontSize: 11,
              fontFamily: "'Space Mono', monospace",
              color: filter === f ? '#f5a623' : '#8892a4',
              cursor: 'pointer',
            }}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>
      {filteredTasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#4e5a6e' }}>No tasks</div>
      ) : (
        filteredTasks.map(task => (
          <TaskCard key={task.id} task={task} onAssign={assignTask} onStatusUpdate={updateTaskStatus} />
        ))
      )}
    </div>
  );
}