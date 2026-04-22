import { useState } from 'react';
import ActivityFeed from '../components/ActivityFeed';
import { WS_URL } from '../config';

function AgentCard({ name, role, emoji, status, description, lastActive }) {
  const statusColor = status === 'active' ? '#4ade80' : status === 'busy' ? '#f5a623' : '#4e5a6e';
  const statusText = status === 'active' ? 'Active' : status === 'busy' ? 'Busy' : 'Idle';

  return (
    <div className="agent-full-card">
      <div className="agent-card-header">
        <div className="agent-emoji-large">{emoji}</div>
        <div className="agent-titles">
          <div className="agent-name-large">{name}</div>
          <div className="agent-role-tag">{role}</div>
        </div>
        <div className="agent-status-indicator">
          <div className="status-dot" style={{ background: statusColor }} />
          <span className="status-label" style={{ color: statusColor }}>{statusText}</span>
        </div>
      </div>
      <div className="agent-desc">{description}</div>
      <div className="agent-footer">
        Last active: {lastActive}
      </div>
    </div>
  );
}

function ToolCard({ name, description, onClick }) {
  return (
    <button className="tool-card-btn" onClick={onClick}>
      <div className="tool-name">{name}</div>
      <div className="tool-desc">{description}</div>
    </button>
  );
}

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agentLogs, setAgentLogs] = useState([]);

  const agents = [
    { id: 'orchestrator', name: 'Orchestrator', role: 'Central Brain', emoji: '🧠', status: 'active', description: 'Coordinates all sub‑agents, resolves conflicts, and enforces hotel policies.', lastActive: 'Just now' },
    { id: 'revenue', name: 'Revenue Agent', role: 'Pricing & Upselling', emoji: '💰', status: 'active', description: 'Analyzes demand, adjusts room rates, and offers personalised upgrades.', lastActive: 'Just now' },
    { id: 'operations', name: 'Operations Agent', role: 'Task Assignment', emoji: '🛠️', status: 'busy', description: 'Assigns housekeeping, maintenance, and staff tasks in real time.', lastActive: '2 seconds ago' },
    { id: 'guest', name: 'Guest Experience Agent', role: 'Personalised Service', emoji: '🛎️', status: 'busy', description: 'Handles requests, sends offers, and anticipates guest needs.', lastActive: '5 seconds ago' },
    { id: 'maintenance', name: 'Maintenance Agent', role: 'Issue Detection', emoji: '🔧', status: 'idle', description: 'Monitors sensors, predicts failures, and dispatches technicians.', lastActive: '2 minutes ago' },
  ];

  const tools = [
    { name: 'Adjust Room Rates', description: 'Trigger dynamic pricing analysis', event: 'overbooking' },
    { name: 'Assign Housekeeping', description: 'Queue cleaning tasks for arrival', event: 'staff_shortage' },
    { name: 'Send Guest Offer', description: 'Push VIP check-in protocol', event: 'vip_guest' },
    { name: 'Trigger Maintenance', description: 'Simulate a sensor failure alert', event: 'room_issue' },
  ];

  const handleToolClick = (tool) => {
    fetch(`${WS_URL.replace('ws', 'http')}/api/simulation/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: tool.event })
    });
  };

  const handleAgentClick = (agent) => {
    setSelectedAgent(agent);
    setAgentLogs([
      { time: new Date().toLocaleTimeString(), log: `${agent.name} system check complete` },
      { time: new Date().toLocaleTimeString(), log: `Monitoring real-time telemetry for ${agent.role}` },
    ]);
  };

  return (
    <div className="agents-page">
      <style>{`
        .agents-page { max-width: 1400px; margin: 0 auto; }
        .page-header { margin-bottom: 32px; }
        .page-title { fontSize: 24px; font-weight: 700; color: #e8eaf0; margin-bottom: 4px; }
        .page-sub { fontSize: 13px; color: #8892a4; }

        .agent-grid-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }

        .section-heading {
          font-size: 11px;
          font-family: 'Space Mono', monospace;
          color: #f5a623;
          letter-spacing: 0.15em;
          margin-bottom: 16px;
          text-transform: uppercase;
          font-weight: 600;
        }

        .agent-full-card {
          background: #0e1117;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 20px;
          transition: all 0.2s;
        }

        .agent-full-card:hover { border-color: rgba(245, 166, 35, 0.3); }

        .agent-card-header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
        .agent-emoji-large { font-size: 32px; }
        .agent-titles { flex: 1; }
        .agent-name-large { font-size: 16px; font-weight: 700; color: #fff; }
        .agent-role-tag { font-size: 10px; font-family: 'Space Mono', monospace; color: #f5a623; text-transform: uppercase; }
        .agent-status-indicator { display: flex; align-items: center; gap: 6px; }
        .status-label { font-size: 10px; font-family: 'Space Mono', monospace; }

        .agent-desc { font-size: 13px; color: #8892a4; line-height: 1.6; margin-bottom: 16px; }
        .agent-footer { font-size: 10px; font-family: 'Space Mono', monospace; color: #3e4e62; }

        .tool-card-btn {
          background: #0e1117;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 16px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
          margin-bottom: 10px;
        }

        .tool-card-btn:hover { border-color: #f5a623; background: rgba(245, 166, 35, 0.03); }
        .tool-name { font-size: 14px; font-weight: 600; color: #fff; margin-bottom: 4px; }
        .tool-desc { font-size: 11px; color: #8892a4; }

        .log-box {
          background: #0e1117;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 16px;
          min-height: 200px;
          max-height: 300px;
          overflow-y: auto;
        }

        .log-entry { padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 11px; font-family: 'Space Mono', monospace; color: #8892a4; }
        .log-time { color: #3e4e62; margin-right: 8px; }

        .global-feed-section {
          margin-top: 40px;
          background: #0e1117;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          height: 350px;
          overflow: hidden;
        }

        @media (max-width: 1024px) {
          .agent-grid-layout { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="page-header">
        <h1 className="page-title">Agent Control Center</h1>
        <p className="page-sub">Monitor and interact with the multi‑agent brain</p>
      </div>

      <div className="agent-grid-layout">
        <div>
          <div className="section-heading">Active Agents</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {agents.map((agent) => (
              <div key={agent.id} onClick={() => handleAgentClick(agent)} style={{ cursor: 'pointer' }}>
                <AgentCard {...agent} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="section-heading">Available Tools</div>
          <div style={{ marginBottom: 32 }}>
            {tools.map((tool) => (
              <ToolCard key={tool.name} {...tool} onClick={() => handleToolClick(tool)} />
            ))}
          </div>

          <div className="section-heading">{selectedAgent ? `${selectedAgent.name} System Logs` : 'Select an Agent'}</div>
          <div className="log-box">
            {selectedAgent ? (
              agentLogs.map((log, idx) => (
                <div key={idx} className="log-entry">
                  <span className="log-time">[{log.time}]</span> {log.log}
                </div>
              ))
            ) : (
              <div style={{ color: '#3e4e62', textAlign: 'center', padding: 40, fontSize: 13 }}>
                Click an agent to inspect telemetry
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 40 }}>
        <div className="section-heading">Global Agent Telemetry</div>
        <div className="global-feed-section">
          <ActivityFeed wsUrl={WS_URL} />
        </div>
      </div>
    </div>
  );
}

