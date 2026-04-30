import { useState, useEffect } from 'react';
import { API_BASE } from '../../config';

export default function SystemHealth() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/system/usage`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('hotelos_token')}` }
    })
    .then(res => res.json())
    .then(setStats);
  }, []);

  return (
    <div>
      <style>{`
        .usage-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 24px; }
        .usage-card { background: #0e1117; border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; text-align: center; }
        .usage-val { font-size: 40px; font-weight: 700; color: #2dd4bf; margin: 12px 0; font-family: 'Space Mono', monospace; }
      `}</style>
      <h1>System Health</h1>
      <div className="usage-grid">
        <div className="usage-card"><h3>Active Guests</h3><div className="usage-val">{stats?.activeGuests}</div></div>
        <div className="usage-card"><h3>Staff Online</h3><div className="usage-val">{stats?.staffOnline}</div></div>
        <div className="usage-card"><h3>Agent Decisions (Today)</h3><div className="usage-val">{stats?.agentDecisionsToday}</div></div>
        <div className="usage-card"><h3>WS Connections</h3><div className="usage-val">{stats?.wsConnections}</div></div>
      </div>
    </div>
  );
}
