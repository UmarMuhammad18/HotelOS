import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ActivityFeed from '../components/ActivityFeed';
import ControlPanel from '../components/ControlPanel';

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: '#0e1117',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12,
      padding: '16px 20px',
    }}>
      <div style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: '#4e5a6e', letterSpacing: '0.1em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || '#e8eaf0', fontFamily: "'Space Mono', monospace" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#8892a4', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function AgentCard({ name, emoji, status, task }) {
  const statusColor = status === 'active' ? '#4ade80' : status === 'busy' ? '#f5a623' : '#4e5a6e';
  const statusText = status === 'active' ? 'Active' : status === 'busy' ? 'Busy' : 'Idle';
  return (
    <div style={{
      background: '#0e1117',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10,
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{ fontSize: 24 }}>{emoji}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0' }}>{name}</div>
        <div style={{ fontSize: 11, color: '#8892a4', marginTop: 2 }}>{task}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
        <span style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: statusColor }}>{statusText}</span>
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

  // Sample chart data
  const occupancyData = [
    { day: 'Mon', occupancy: 72 }, { day: 'Tue', occupancy: 68 }, { day: 'Wed', occupancy: 75 },
    { day: 'Thu', occupancy: 82 }, { day: 'Fri', occupancy: 88 }, { day: 'Sat', occupancy: 91 }, { day: 'Sun', occupancy: 84 }
  ];
  const revenueData = [
    { type: 'Standard', revenue: 8240 }, { type: 'Deluxe', revenue: 11200 },
    { type: 'Suite', revenue: 18900 }, { type: 'Penthouse', revenue: 25500 }
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontFamily: "'Space Mono', monospace", color: '#e8eaf0', marginBottom: 4 }}>
            Dashboard
          </h1>
          <p style={{ fontSize: 13, color: '#8892a4' }}>Real-time hotel operations overview</p>
        </div>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: '#f5a623', background: '#0e1117', padding: '6px 12px', borderRadius: 6 }}>
          {clock}
        </div>
      </div>

      {/* Control Panel */}
      <ControlPanel />

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {metrics.map((m, i) => (
          <MetricCard key={i} label={m.label} value={m.value} sub={m.sub} color={m.color} />
        ))}
      </div>

      {/* Charts Section */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", color: '#f5a623', letterSpacing: '0.1em', marginBottom: 12 }}>
          ANALYTICS OVERVIEW
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, color: '#8892a4', marginBottom: 12 }}>Occupancy Trend (Last 7 Days)</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={occupancyData}>
                <CartesianGrid stroke="#1c2230" strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke="#4e5a6e" fontSize={10} />
                <YAxis stroke="#4e5a6e" fontSize={10} />
                <Tooltip contentStyle={{ background: '#0e1117', border: '1px solid #f5a623', borderRadius: 8 }} />
                <Line type="monotone" dataKey="occupancy" stroke="#f5a623" strokeWidth={2} dot={{ fill: '#f5a623' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, color: '#8892a4', marginBottom: 12 }}>Revenue by Room Type</div>
            <ResponsiveContainer width="100%" height={200}>
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
      </div>

      {/* Two-column layout: Agents + Activity Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 24 }}>
        <div>
          <div style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", color: '#f5a623', letterSpacing: '0.1em', marginBottom: 12 }}>
            AGENT STATUS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {agents.map((agent, i) => (
              <AgentCard key={i} {...agent} />
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", color: '#f5a623', letterSpacing: '0.1em', marginBottom: 12 }}>
            LIVE ACTIVITY FEED
          </div>
          <div style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, height: 400, overflow: 'hidden' }}>
            <ActivityFeed wsUrl="ws://localhost:8080" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ marginTop: 32 }}>
        <div style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", color: '#f5a623', letterSpacing: '0.1em', marginBottom: 12 }}>
          QUICK ACTIONS
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={{ background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.3)', borderRadius: 8, padding: '8px 16px', color: '#2dd4bf', fontFamily: "'Space Mono', monospace", fontSize: 11, cursor: 'pointer' }}>
            ⚡ Trigger Maintenance Alert
          </button>
          <button style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 8, padding: '8px 16px', color: '#f5a623', fontFamily: "'Space Mono', monospace", fontSize: 11, cursor: 'pointer' }}>
            💰 Simulate Revenue Spike
          </button>
          <button style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 8, padding: '8px 16px', color: '#60a5fa', fontFamily: "'Space Mono', monospace", fontSize: 11, cursor: 'pointer' }}>
            🧹 Request Housekeeping
          </button>
        </div>
      </div>
    </div>
  );
}