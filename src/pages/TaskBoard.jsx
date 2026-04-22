import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useWebSocketStore from '../stores/useWebSocketStore';

function TaskCard({ task, onAssign, onStatusUpdate }) {
  const statusColors = {
    pending: '#f5a623',
    'in-progress': '#60a5fa',
    completed: '#4ade80',
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="task-card"
    >
      <div className="task-header">
        <h3 className="task-title">{task.title}</h3>
        <span className="status-badge" style={{ 
          background: `${statusColors[task.status]}15`, 
          color: statusColors[task.status],
          borderColor: `${statusColors[task.status]}30`
        }}>
          {task.status.replace('-', ' ')}
        </span>
      </div>
      <p className="task-desc">{task.description}</p>
      
      <div className="task-actions">
        <div className="assign-box">
          <label className="action-label">ASSIGNED TO</label>
          <select
            className="task-select"
            value={task.assignedTo || ''}
            onChange={(e) => onAssign(task.id, e.target.value)}
          >
            <option value="">Unassigned</option>
            <option value="John">John (Housekeeping)</option>
            <option value="Sarah">Sarah (Maintenance)</option>
            <option value="Mike">Mike (Front Desk)</option>
            <option value="AI Agent">AI Agent (Automated)</option>
          </select>
        </div>
        
        {task.status !== 'completed' && (
          <button
            className="complete-btn"
            onClick={() => onStatusUpdate(task.id, 'completed')}
          >
            Mark Complete
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
    <div className="task-board-container">
      <style>{`
        .task-board-container {
          max-width: 900px;
          margin: 0 auto;
        }

        .board-header {
          margin-bottom: 32px;
        }

        .board-title {
          font-size: 24px;
          font-weight: 700;
          color: #e8eaf0;
          margin-bottom: 8px;
        }

        .filter-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 32px;
        }

        .filter-btn {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 10px;
          padding: 8px 16px;
          font-size: 11px;
          font-family: 'Space Mono', monospace;
          color: #8892a4;
          cursor: pointer;
          transition: all 0.2s;
        }

        .filter-btn.active {
          background: rgba(245, 166, 35, 0.1);
          border-color: #f5a623;
          color: #f5a623;
        }

        .task-card {
          background: #0e1117;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 16px;
          transition: border-color 0.2s;
        }

        .task-card:hover {
          border-color: rgba(255, 255, 255, 0.12);
        }

        .task-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .task-title {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
        }

        .status-badge {
          font-size: 9px;
          font-family: 'Space Mono', monospace;
          font-weight: 700;
          padding: 2px 10px;
          border-radius: 6px;
          border: 1px solid transparent;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .task-desc {
          font-size: 13px;
          color: #8892a4;
          line-height: 1.6;
          margin-bottom: 20px;
        }

        .task-actions {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.03);
        }

        .action-label {
          display: block;
          font-size: 9px;
          font-family: 'Space Mono', monospace;
          color: #4e5a6e;
          margin-bottom: 6px;
          letter-spacing: 0.1em;
        }

        .task-select {
          background: #0c0f16;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 12px;
          color: #e8eaf0;
          outline: none;
          cursor: pointer;
        }

        .complete-btn {
          background: rgba(74, 222, 128, 0.1);
          border: 1px solid rgba(74, 222, 128, 0.3);
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 11px;
          font-family: 'Space Mono', monospace;
          color: #4ade80;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .complete-btn:hover {
          background: rgba(74, 222, 128, 0.2);
          border-color: #4ade80;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px dashed rgba(255, 255, 255, 0.07);
          border-radius: 16px;
          color: #3e4e62;
          font-size: 14px;
        }
      `}</style>

      <div className="board-header">
        <h1 className="board-title">Operations Task Board</h1>
        <div className="filter-row">
          {['all', 'pending', 'in-progress', 'completed'].map(f => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="task-list">
        <AnimatePresence mode="popLayout">
          {filteredTasks.length === 0 ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="empty-state"
            >
              No tasks match the current filter
            </motion.div>
          ) : (
            filteredTasks.map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                onAssign={assignTask} 
                onStatusUpdate={updateTaskStatus} 
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}