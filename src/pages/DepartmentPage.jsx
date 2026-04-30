import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import '../styles/DepartmentPage.css';

const DEPARTMENT_INFO = {
  concierge: {
    name: 'Concierge',
    icon: '🎩',
    description: 'Guest services and request coordination',
    color: '#8b5cf6',
    tasks: ['Guest requests', 'Activity bookings', 'Reservations', 'Information desk'],
  },
  food_beverage: {
    name: 'Food & Beverage',
    icon: '🍽️',
    description: 'Restaurant, bar, and room service operations',
    color: '#f59e0b',
    tasks: ['Restaurant service', 'Bar operations', 'Room service', 'Menu planning'],
  },
  housekeeping: {
    name: 'Housekeeping',
    icon: '🧹',
    description: 'Room cleaning and maintenance',
    color: '#10b981',
    tasks: ['Room cleaning', 'Linen management', 'Inventory', 'Deep cleaning'],
  },
  maintenance: {
    name: 'Maintenance',
    icon: '🔧',
    description: 'Facilities and equipment repair',
    color: '#ef4444',
    tasks: ['Equipment repair', 'Preventive maintenance', 'Troubleshooting', 'Inspections'],
  },
  front_office: {
    name: 'Front Office',
    icon: '🛎️',
    description: 'Guest check-in and reception',
    color: '#06b6d4',
    tasks: ['Check-ins', 'Check-outs', 'Billing', 'Phone service'],
  },
  guest_relations: {
    name: 'Guest Relations',
    icon: '🤝',
    description: 'Guest satisfaction and complaint resolution',
    color: '#ec4899',
    tasks: ['Guest feedback', 'Complaint resolution', 'Follow-up calls', 'Satisfaction surveys'],
  },
  guest_experience: {
    name: 'Guest Experience',
    icon: '⭐',
    description: 'Experience enhancement and events',
    color: '#6366f1',
    tasks: ['Event coordination', 'Special experiences', 'Personalization', 'Entertainment'],
  },
};

function DepartmentPage() {
  const location = useLocation();
  const [selectedTask, setSelectedTask] = useState(null);

  // Extract department from URL
  const pathParts = location.pathname.split('/');
  const deptKey = pathParts[3]; // /dashboard/department/[deptKey]
  
  const deptInfo = DEPARTMENT_INFO[deptKey];
  
  if (!deptInfo) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Department not found</h2>
      </div>
    );
  }

  // Mock department staff
  const departmentStaff = [
    { id: 1, name: 'Alice Johnson', role: 'Manager', status: 'active' },
    { id: 2, name: 'Bob Smith', role: 'Senior Staff', status: 'active' },
    { id: 3, name: 'Carol White', role: 'Staff', status: 'busy' },
  ];

  // Mock department metrics
  const metrics = [
    { label: 'Active Tasks', value: 12, change: '+2 today' },
    { label: 'Team Members', value: departmentStaff.length, change: 'all online' },
    { label: 'Completion Rate', value: '94%', change: '+3% this week' },
    { label: 'Avg Response Time', value: '4min', change: '-1min from avg' },
  ];

  // Mock tasks
  const tasks = [
    { id: 1, title: 'Urgent: Room 401 - AC not working', priority: 'high', status: 'in-progress', assignedTo: 'Bob Smith' },
    { id: 2, title: 'Guest at 305 requests late checkout', priority: 'medium', status: 'pending', assignedTo: 'Unassigned' },
    { id: 3, title: 'Restock mini bars (Floors 1-3)', priority: 'low', status: 'pending', assignedTo: 'Carol White' },
    { id: 4, title: 'Follow up on guest complaint - Room 210', priority: 'high', status: 'pending', assignedTo: 'Unassigned' },
    { id: 5, title: 'Staff meeting prep - Tuesday 2pm', priority: 'medium', status: 'pending', assignedTo: 'Alice Johnson' },
  ];

  const getPriorityColor = (priority) => {
    const colors = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
    return colors[priority] || '#666';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="department-container"
    >
      {/* Header */}
      <div className="department-header" style={{ borderTopColor: deptInfo.color }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '2.5rem' }}>{deptInfo.icon}</span>
          <div>
            <h1>{deptInfo.name}</h1>
            <p className="dept-desc">{deptInfo.description}</p>
          </div>
        </div>
        <div className="dept-badge" style={{ background: `${deptInfo.color}20`, color: deptInfo.color, borderColor: `${deptInfo.color}40` }}>
          {deptInfo.tasks.join(' • ')}
        </div>
      </div>

      {/* Metrics Grid */}
      <motion.div className="metrics-grid">
        <AnimatePresence>
          {metrics.map((metric, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="metric-card"
            >
              <div className="metric-value">{metric.value}</div>
              <div className="metric-label">{metric.label}</div>
              <div className="metric-change">{metric.change}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Main Content Grid */}
      <div className="dept-content-grid">
        {/* Tasks Column */}
        <div className="dept-column tasks-column">
          <h2 className="column-title">📋 Active Tasks</h2>
          <div className="tasks-list">
            <AnimatePresence>
              {tasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onClick={() => setSelectedTask(task)}
                  className={`task-item ${selectedTask?.id === task.id ? 'selected' : ''}`}
                >
                  <div className="task-priority" style={{ background: getPriorityColor(task.priority) }} />
                  <div className="task-content">
                    <h3>{task.title}</h3>
                    <div className="task-meta">
                      <span className="task-priority-label">{task.priority}</span>
                      <span className="task-status">{task.status}</span>
                      <span className="task-assignee">→ {task.assignedTo}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Team Column */}
        <div className="dept-column team-column">
          <h2 className="column-title">👥 Team Members</h2>
          <div className="team-list">
            <AnimatePresence>
              {departmentStaff.map((member) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="team-member"
                >
                  <div className="member-avatar">{member.name.charAt(0)}</div>
                  <div className="member-info">
                    <h4>{member.name}</h4>
                    <p>{member.role}</p>
                  </div>
                  <div className={`status-indicator ${member.status}`}>
                    <span className="status-dot" />
                    {member.status}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Department Statistics */}
          <div className="dept-stats">
            <h3>Department Stats</h3>
            <div className="stat-row">
              <span>Tasks Completed Today</span>
              <strong>18</strong>
            </div>
            <div className="stat-row">
              <span>Avg Response Time</span>
              <strong>4 min</strong>
            </div>
            <div className="stat-row">
              <span>Customer Satisfaction</span>
              <strong>4.8/5</strong>
            </div>
            <div className="stat-row">
              <span>Team Productivity</span>
              <strong>94%</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Task Detail */}
      <AnimatePresence>
        {selectedTask && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="task-detail-panel"
          >
            <div className="detail-header">
              <h3>{selectedTask.title}</h3>
              <button onClick={() => setSelectedTask(null)} className="close-btn">×</button>
            </div>
            <div className="detail-content">
              <div className="detail-row">
                <span>Priority:</span>
                <span className="priority-badge" style={{ color: getPriorityColor(selectedTask.priority) }}>
                  {selectedTask.priority.toUpperCase()}
                </span>
              </div>
              <div className="detail-row">
                <span>Status:</span>
                <span className="status-badge">{selectedTask.status}</span>
              </div>
              <div className="detail-row">
                <span>Assigned To:</span>
                <span>{selectedTask.assignedTo}</span>
              </div>
              <div className="detail-actions">
                <button className="action-btn primary">Accept Task</button>
                <button className="action-btn">Mark Complete</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default DepartmentPage;
