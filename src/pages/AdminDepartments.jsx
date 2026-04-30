import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/AdminDepartments.css';

const DEPARTMENTS = [
  {
    id: 'concierge',
    name: 'Concierge',
    icon: '🎩',
    description: 'Guest services and request coordination',
    color: '#8b5cf6',
    staffCount: 12,
    activeTasksCount: 8,
    satisfaction: 4.8,
  },
  {
    id: 'food_beverage',
    name: 'Food & Beverage',
    icon: '🍽️',
    description: 'Restaurant, bar, and room service operations',
    color: '#f59e0b',
    staffCount: 28,
    activeTasksCount: 15,
    satisfaction: 4.6,
  },
  {
    id: 'housekeeping',
    name: 'Housekeeping',
    icon: '🧹',
    description: 'Room cleaning and maintenance',
    color: '#10b981',
    staffCount: 35,
    activeTasksCount: 42,
    satisfaction: 4.7,
  },
  {
    id: 'maintenance',
    name: 'Maintenance',
    icon: '🔧',
    description: 'Facilities and equipment repair',
    color: '#ef4444',
    staffCount: 8,
    activeTasksCount: 5,
    satisfaction: 4.5,
  },
  {
    id: 'front_office',
    name: 'Front Office',
    icon: '🛎️',
    description: 'Guest check-in and reception',
    color: '#06b6d4',
    staffCount: 16,
    activeTasksCount: 9,
    satisfaction: 4.9,
  },
  {
    id: 'guest_relations',
    name: 'Guest Relations',
    icon: '🤝',
    description: 'Guest satisfaction and complaint resolution',
    color: '#ec4899',
    staffCount: 6,
    activeTasksCount: 4,
    satisfaction: 4.8,
  },
  {
    id: 'guest_experience',
    name: 'Guest Experience',
    icon: '⭐',
    description: 'Experience enhancement and events',
    color: '#6366f1',
    staffCount: 10,
    activeTasksCount: 7,
    satisfaction: 4.9,
  },
];

function AdminDepartments() {
  const [selectedDept, setSelectedDept] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const filteredDepts = DEPARTMENTS.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'staff') return b.staffCount - a.staffCount;
    if (sortBy === 'tasks') return b.activeTasksCount - a.activeTasksCount;
    if (sortBy === 'satisfaction') return b.satisfaction - a.satisfaction;
    return 0;
  });

  const totalStaff = DEPARTMENTS.reduce((sum, d) => sum + d.staffCount, 0);
  const totalTasks = DEPARTMENTS.reduce((sum, d) => sum + d.activeTasksCount, 0);
  const avgSatisfaction = (DEPARTMENTS.reduce((sum, d) => sum + d.satisfaction, 0) / DEPARTMENTS.length).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="admin-departments-container"
    >
      {/* Header */}
      <div className="dept-header">
        <div>
          <h1>🏢 Department Overview</h1>
          <p>Manage and monitor all hotel departments</p>
        </div>
        <button className="add-dept-btn">+ Add Department</button>
      </div>

      {/* Overview Stats */}
      <motion.div className="overview-stats">
        <AnimatePresence>
          <div className="stat-card">
            <div className="stat-value">{DEPARTMENTS.length}</div>
            <div className="stat-label">Total Departments</div>
            <div className="stat-subtext">All operational</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{totalStaff}</div>
            <div className="stat-label">Total Staff</div>
            <div className="stat-subtext">Across all departments</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{totalTasks}</div>
            <div className="stat-label">Active Tasks</div>
            <div className="stat-subtext">Pending completion</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{avgSatisfaction}</div>
            <div className="stat-label">Avg Satisfaction</div>
            <div className="stat-subtext">Out of 5.0</div>
          </div>
        </AnimatePresence>
      </motion.div>

      {/* Filters & Search */}
      <div className="filters-bar">
        <div className="search-box">
          <span>🔍</span>
          <input
            type="text"
            placeholder="Search departments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="sort-box">
          <label>Sort by:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="name">Name</option>
            <option value="staff">Staff Count</option>
            <option value="tasks">Active Tasks</option>
            <option value="satisfaction">Satisfaction</option>
          </select>
        </div>
      </div>

      {/* Departments Grid */}
      <motion.div className="departments-grid">
        <AnimatePresence>
          {filteredDepts.map((dept, idx) => (
            <motion.div
              key={dept.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => setSelectedDept(dept)}
              className={`dept-card ${selectedDept?.id === dept.id ? 'selected' : ''}`}
              style={{ borderTopColor: dept.color }}
            >
              <div className="dept-card-header">
                <span style={{ fontSize: '2.5rem' }}>{dept.icon}</span>
                <div className="dept-card-title">
                  <h3>{dept.name}</h3>
                  <p>{dept.description}</p>
                </div>
              </div>

              <div className="dept-card-stats">
                <div className="card-stat">
                  <span className="card-stat-value">{dept.staffCount}</span>
                  <span className="card-stat-label">Staff</span>
                </div>
                <div className="card-stat">
                  <span className="card-stat-value">{dept.activeTasksCount}</span>
                  <span className="card-stat-label">Tasks</span>
                </div>
                <div className="card-stat">
                  <span className="card-stat-value">{dept.satisfaction}</span>
                  <span className="card-stat-label">Rating</span>
                </div>
              </div>

              <div className="dept-card-progress">
                <div className="progress-bar" style={{ background: dept.color }}>
                  <div className="progress-fill" style={{ width: `${(dept.satisfaction / 5) * 100}%` }} />
                </div>
                <span className="progress-text">Customer Satisfaction</span>
              </div>

              <button className="dept-card-action">View Details →</button>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedDept && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="detail-panel"
          >
            <div className="panel-header" style={{ borderTopColor: selectedDept.color }}>
              <h2>{selectedDept.icon} {selectedDept.name}</h2>
              <button onClick={() => setSelectedDept(null)} className="close-panel-btn">×</button>
            </div>

            <div className="panel-content">
              <div className="panel-section">
                <h3>Department Information</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Name</label>
                    <value>{selectedDept.name}</value>
                  </div>
                  <div className="info-item">
                    <label>Description</label>
                    <value>{selectedDept.description}</value>
                  </div>
                  <div className="info-item">
                    <label>Staff Count</label>
                    <value>{selectedDept.staffCount}</value>
                  </div>
                  <div className="info-item">
                    <label>Active Tasks</label>
                    <value>{selectedDept.activeTasksCount}</value>
                  </div>
                </div>
              </div>

              <div className="panel-section">
                <h3>Performance Metrics</h3>
                <div className="metric-row">
                  <span>Customer Satisfaction</span>
                  <div className="metric-bar">
                    <div className="metric-fill" style={{ 
                      width: `${(selectedDept.satisfaction / 5) * 100}%`,
                      background: selectedDept.color
                    }} />
                  </div>
                  <span className="metric-value">{selectedDept.satisfaction}/5.0</span>
                </div>
                <div className="metric-row">
                  <span>Task Completion Rate</span>
                  <div className="metric-bar">
                    <div className="metric-fill" style={{ 
                      width: '87%',
                      background: selectedDept.color
                    }} />
                  </div>
                  <span className="metric-value">87%</span>
                </div>
                <div className="metric-row">
                  <span>Staff Utilization</span>
                  <div className="metric-bar">
                    <div className="metric-fill" style={{ 
                      width: '92%',
                      background: selectedDept.color
                    }} />
                  </div>
                  <span className="metric-value">92%</span>
                </div>
              </div>

              <div className="panel-section">
                <h3>Quick Actions</h3>
                <div className="action-grid">
                  <button className="action-button">👁️ View Staff</button>
                  <button className="action-button">📋 View Tasks</button>
                  <button className="action-button">⚙️ Settings</button>
                  <button className="action-button">📊 Analytics</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default AdminDepartments;
