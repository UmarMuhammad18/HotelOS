import { useState } from 'react';
import ActivityFeed from '../components/ActivityFeed';

// Agent card for the main grid
function AgentCard({ name, role, emoji, status, description, lastActive }) {
  const statusColor = status === 'active' ? '#4ade80' : status === 'busy' ? '#f5a623' : '#4e5a6e';
  const statusText = status === 'active' ? 'Active' : status === 'busy' ? 'Busy' : 'Idle';

  return (
    <div style={{
      background: '#0e1117',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12,
      padding: '16px',
      transition: 'border-color 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 28 }}>{emoji}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#e8eaf0' }}>{name}</div>
          <div style={{ fontSize: 11, color: '#8892a4', fontFamily: "'Space Mono', monospace" }}>{role}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
          <span style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: statusColor }}>{statusText}</span>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#8892a4', marginBottom: 12 }}>{description}</div>
      <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: '#4e5a6e' }}>
        Last active: {lastActive}
      </div>
    </div>
  );
}

// Tool card for available agent tools
function ToolCard({ name, description, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: '#0e1117',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 8,
        padding: '10px 14px',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'border-color 0.2s',
        width: '100%',
      }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = '#f5a623'}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}
    >
      <div style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0', marginBottom: 4 }}>{name}</div>
      <div style={{ fontSize: 11, color: '#8892a4' }}>{description}</div>
    </button>
  );
}

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agentLogs, setAgentLogs] = useState([]);

  const agents = [
    {
      id: 'orchestrator',
      name: 'Orchestrator',
      role: 'Central Brain',
      emoji: '🧠',
      status: 'active',
      description: 'Coordinates all sub‑agents, resolves conflicts, and enforces hotel policies.',
      lastActive: 'Just now',
    },
    {
      id: 'revenue',
      name: 'Revenue Agent',
      role: 'Pricing & Upselling',
      emoji: '💰',
      status: 'active',
      description: 'Analyzes demand, adjusts room rates, and offers personalised upgrades.',
      lastActive: 'Just now',
    },
    {
      id: 'operations',
      name: 'Operations Agent',
      role: 'Task Assignment',
      emoji: '🛠️',
      status: 'busy',
      description: 'Assigns housekeeping, maintenance, and staff tasks in real time.',
      lastActive: '2 seconds ago',
    },
    {
      id: 'guest',
      name: 'Guest Experience Agent',
      role: 'Personalised Service',
      emoji: '🛎️',
      status: 'busy',
      description: 'Handles requests, sends offers, and anticipates guest needs.',
      lastActive: '5 seconds ago',
    },
    {
      id: 'maintenance',
      name: 'Maintenance Agent',
      role: 'Issue Detection',
      emoji: '🔧',
      status: 'idle',
      description: 'Monitors sensors, predicts failures, and dispatches technicians.',
      lastActive: '2 minutes ago',
    },
  ];

  const tools = [
    { name: 'Adjust Room Rates', description: 'Modify pricing based on occupancy and demand', action: 'rate_adjust' },
    { name: 'Assign Housekeeping', description: 'Queue cleaning tasks for specific rooms', action: 'assign_cleaning' },
    { name: 'Send Guest Offer', description: 'Push upgrade or service offers to guests', action: 'send_offer' },
    { name: 'Trigger Maintenance', description: 'Create a maintenance ticket', action: 'trigger_maintenance' },
  ];

  const handleToolClick = (tool) => {
    alert(`Demo: ${tool.name} would be sent to the agent system.`);
    // Here you would send a WebSocket message to your backend
  };

  const handleAgentClick = (agent) => {
    setSelectedAgent(agent);
    // Simulate fetching logs – replace with real data
    setAgentLogs([
      { time: new Date().toLocaleTimeString(), log: `${agent.name} initialised` },
      { time: new Date().toLocaleTimeString(), log: `${agent.name} is now monitoring hotel state` },
    ]);
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontFamily: "'Space Mono', monospace", color: '#e8eaf0', marginBottom: 4 }}>
          Agent Control Center
        </h1>
        <p style={{ fontSize: 13, color: '#8892a4' }}>
          Monitor and interact with the multi‑agent system
        </p>
      </div>

      {/* Two‑column layout: Agents (left) + Tools / Logs (right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left column: Agent cards */}
        <div>
          <div style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", color: '#f5a623', letterSpacing: '0.1em', marginBottom: 12 }}>
            ACTIVE AGENTS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {agents.map((agent) => (
              <div key={agent.id} onClick={() => handleAgentClick(agent)} style={{ cursor: 'pointer' }}>
                <AgentCard {...agent} />
              </div>
            ))}
          </div>
        </div>

        {/* Right column: Tools + Logs */}
        <div>
          {/* Tools section */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", color: '#f5a623', letterSpacing: '0.1em', marginBottom: 12 }}>
              AVAILABLE TOOLS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tools.map((tool) => (
                <ToolCard key={tool.name} {...tool} onClick={() => handleToolClick(tool)} />
              ))}
            </div>
          </div>

          {/* Agent logs (when an agent is selected) */}
          <div>
            <div style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", color: '#f5a623', letterSpacing: '0.1em', marginBottom: 12 }}>
              {selectedAgent ? `${selectedAgent.name} LOGS` : 'SELECT AN AGENT'}
            </div>
            <div style={{
              background: '#0e1117',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12,
              padding: '12px',
              minHeight: 200,
              maxHeight: 280,
              overflowY: 'auto',
            }}>
              {selectedAgent ? (
                agentLogs.length > 0 ? (
                  agentLogs.map((log, idx) => (
                    <div key={idx} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 11, fontFamily: "'Space Mono', monospace", color: '#8892a4' }}>
                      <span style={{ color: '#4e5a6e' }}>[{log.time}]</span> {log.log}
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#4e5a6e', textAlign: 'center', padding: 20 }}>No logs yet</div>
                )
              ) : (
                <div style={{ color: '#4e5a6e', textAlign: 'center', padding: 20 }}>
                  Click on any agent to see its activity log
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Real‑time activity feed (full width) */}
      <div style={{ marginTop: 32 }}>
        <div style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", color: '#f5a623', letterSpacing: '0.1em', marginBottom: 12 }}>
          GLOBAL AGENT FEED
        </div>
        <div style={{
          background: '#0e1117',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12,
          height: 320,
          overflow: 'hidden',
        }}>
          <ActivityFeed wsUrl="ws://localhost:8080" />
        </div>
      </div>
    </div>
  );
}
