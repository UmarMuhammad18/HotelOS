import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ActivityFeed from '../components/ActivityFeed';
import ControlPanel from '../components/ControlPanel';
import { WS_URL } from '../config';

function MetricCard({ label, value, sub, color }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ color: color || '#e8eaf0' }}>{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

function AgentCard({ name, emoji, status, task }) {
  const statusColor = status === 'active' ? '#4ade80' : status === 'busy' ? '#f5a623' : '#4e5a6e';
  const statusText = status === 'active' ? 'Active' : status === 'busy' ? 'Busy' : 'Idle';
  return (
    <div className="agent-card">
      <div className="agent-emoji">{emoji}</div>
      <div className="agent-info">
        <div className="agent-name">{name}</div>
        <div className="agent-task">{task}</div>
      </div>
      <div className="agent-status-box">
        <div className="status-dot" style={{ background: statusColor }} />
        <span className="status-text" style={{ color: statusColor }}>{statusText}</span>
      </div>
    </div>
  );
}

export default function DashboardHome() {
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString());
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const metrics = [
    { label: 'OCCUPANCY', value: '78%', sub: '↑ 3% vs yesterday', color: '#2dd4bf' },
    { label: 'REVENUE / NIGHT', value: '$14,820', sub: 'ADR $189', color: '#f5a623' },
    { label: 'ACTIVE AGENTS', value: '4/5', sub: '1 resolving alert', color: '#60a5fa' },
    { label: 'PENDING TASKS', value: '3', sub: '2 high priority', color: '#f87171' },
  ];

  const agents = [
    { name: 'Orchestrator', emoji: '🧠', status: 'active', task: 'Coordinating all agents' },
    { name: 'Operations', emoji: '🛠️', status: 'busy', task: 'Assigning housekeeping' },
    { name: 'Revenue', emoji: '💰', status: 'active', task: 'Optimising pricing' },
    { name: 'Guest Experience', emoji: '🛎️', status: 'busy', task: 'Processing requests' },
    { name: 'Maintenance', emoji: '🔧', status: 'idle', task: 'No active issues' },
  ];

  const occupancyData = [
    { day: 'Mon', occupancy: 72 }, { day: 'Tue', occupancy: 68 }, { day: 'Wed', occupancy: 75 },
    { day: 'Thu', occupancy: 82 }, { day: 'Fri', occupancy: 88 }, { day: 'Sat', occupancy: 91 }, { day: 'Sun', occupancy: 84 }
  ];
  const revenueData = [
    { type: 'Standard', revenue: 8240 }, { type: 'Deluxe', revenue: 11200 },
    { type: 'Suite', revenue: 18900 }, { type: 'Penthouse', revenue: 25500 }
  ];

  return (
    <div className="dashboard-home">
      <style>{`
        .dashboard-home {
          max-width: 1400px;
          margin: 0 auto;
        }

        .header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .clock-badge {
          font-family: 'Space Mono', monospace;
          font-size: 12px;
          color: #f5a623;
          background: #0e1117;
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid rgba(245, 166, 35, 0.2);
        }

        .section-label {
          font-size: 11px;
          font-family: 'Space Mono', monospace;
          color: #f5a623;
          letter-spacing: 0.15em;
          margin-bottom: 16px;
          text-transform: uppercase;
          font-weight: 600;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 32px;
        }

        .metric-card {
          background: #0e1117;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 20px;
          transition: transform 0.2s;
        }

        .metric-card:hover {
          transform: translateY(-2px);
          border-color: rgba(255,255,255,0.12);
        }

        .metric-label {
          font-size: 10px;
          font-family: 'Space Mono', monospace;
          color: #4e5a6e;
          letter-spacing: 0.1em;
          margin-bottom: 8px;
        }

        .metric-value {
          font-size: 24px;
          font-weight: 700;
          font-family: 'Space Mono', monospace;
        }

        .metric-sub {
          font-size: 11px;
          color: #8892a4;
          margin-top: 8px;
        }

        .charts-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 32px;
        }

        .chart-box {
          background: #0e1117;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 20px;
        }

        .main-columns {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 24px;
          margin-bottom: 32px;
        }

        .agent-card {
          background: #0e1117;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .agent-emoji { font-size: 24px; }
        .agent-info { flex: 1; }
        .agent-name { fontSize: 13px; font-weight: 600; color: #e8eaf0; }
        .agent-task { fontSize: 11px; color: #8892a4; margin-top: 2px; }
        .agent-status-box { display: flex; alignItems: center; gap: 6px; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; }
        .status-text { font-size: 10px; font-family: 'Space Mono', monospace; }

        .feed-container {
          background: #0e1117;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          height: 450px;
          overflow: hidden;
        }

        .actions-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .action-btn {
          border-radius: 8px;
          padding: 10px 18px;
          font-family: 'Space Mono', monospace;
          font-size: 11px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        @media (max-width: 1024px) {
          .metrics-grid { grid-template-columns: 1fr 1fr; }
          .charts-grid { grid-template-columns: 1fr; }
          .main-columns { grid-template-columns: 1fr; }
        }

        @media (max-width: 640px) {
          .metrics-grid { grid-template-columns: 1fr; }
          .header-row { flex-direction: column; align-items: flex-start; gap: 12px; }
        }
      `}</style>

      <div className="header-row">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e8eaf0', marginBottom: 4 }}>
            Operations Cockpit
          </h1>
          <p style={{ fontSize: 13, color: '#8892a4' }}>Real-time multi-agent orchestration</p>
        </div>
        <div className="clock-badge">
          {clock}
        </div>
      </div>

      <ControlPanel />

      <div className="section-label">Live Metrics</div>
      <div className="metrics-grid">
        {metrics.map((m, i) => (
          <MetricCard key={i} label={m.label} value={m.value} sub={m.sub} color={m.color} />
        ))}
      </div>

      <div className="section-label">Analytics Overview</div>
      <div className="charts-grid">
        <div className="chart-box">
          <div style={{ fontSize: 11, color: '#8892a4', marginBottom: 16 }}>Occupancy Trend (Last 7 Days)</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={occupancyData}>
              <CartesianGrid stroke="#1c2230" strokeDasharray="3 3" />
              <XAxis dataKey="day" stroke="#4e5a6e" fontSize={10} />
              <YAxis stroke="#4e5a6e" fontSize={10} />
              <Tooltip contentStyle={{ background: '#0e1117', border: '1px solid #f5a623', borderRadius: 8 }} />
              <Line type="monotone" dataKey="occupancy" stroke="#f5a623" strokeWidth={3} dot={{ fill: '#f5a623', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-box">
          <div style={{ fontSize: 11, color: '#8892a4', marginBottom: 16 }}>Revenue by Room Type</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueData}>
              <CartesianGrid stroke="#1c2230" strokeDasharray="3 3" />
              <XAxis dataKey="type" stroke="#4e5a6e" fontSize={10} />
              <YAxis stroke="#4e5a6e" fontSize={10} />
              <Tooltip contentStyle={{ background: '#0e1117', border: '1px solid #f5a623', borderRadius: 8 }} />
              <Bar dataKey="revenue" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="main-columns">
        <div>
          <div className="section-label">Agent Status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {agents.map((agent, i) => (
              <AgentCard key={i} {...agent} />
            ))}
          </div>
        </div>
        <div>
          <div className="section-label">Live Activity Feed</div>
          <div className="feed-container">
            <ActivityFeed wsUrl={WS_URL} />
          </div>
        </div>
      </div>

      <div className="section-label">Quick Actions</div>
      <div className="actions-grid">
        <button 
          className="action-btn" 
          style={{ background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.3)', color: '#2dd4bf' }}
          onClick={() => fetch(`${WS_URL.replace('ws', 'http')}/api/simulation/event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventType: 'room_issue' })
          })}
        >
          ⚡ Trigger Maintenance Alert
        </button>
        <button 
          className="action-btn" 
          style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.3)', color: '#f5a623' }}
          onClick={() => fetch(`${WS_URL.replace('ws', 'http')}/api/simulation/event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventType: 'vip_guest' })
          })}
        >
          💰 Simulate VIP Arrival
        </button>
        <button 
          className="action-btn" 
          style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa' }}
          onClick={() => fetch(`${WS_URL.replace('ws', 'http')}/api/simulation/event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventType: 'late_arrival' })
          })}
        >
          🧹 Request Late Prep
        </button>
      </div>
    </div>
  );
}

