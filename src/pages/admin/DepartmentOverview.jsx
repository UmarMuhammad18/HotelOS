import { useState, useEffect } from 'react';

export default function DepartmentOverview() {
  const [depts, setDepts] = useState({});

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL || ''}/api/admin/departments`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('hotelos_token')}` }
    })
    .then(res => res.json())
    .then(setDepts);
  }, []);

  return (
    <div>
      <style>{`
        .dept-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 24px; }
        .dept-card { background: #0e1117; border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; }
        .dept-name { font-size: 20px; font-weight: 700; color: #f5a623; margin-bottom: 16px; }
        .dept-metric { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
      `}</style>
      <h1>Department Overview</h1>
      <div className="dept-grid">
        {Object.entries(depts).map(([name, data]) => (
          <div key={name} className="dept-card">
            <div className="dept-name">{name}</div>
            <div className="dept-metric"><span>Tasks Completed</span> <span>{data.completed}</span></div>
            <div className="dept-metric"><span>Pending</span> <span>{data.pending}</span></div>
            <div className="dept-metric"><span>Avg Response</span> <span>{data.avgResponse}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
