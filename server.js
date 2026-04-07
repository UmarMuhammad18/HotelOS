const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });

const agents = ['Orchestrator', 'Revenue AI', 'Maintenance AI', 'Concierge AI', 'Housekeeping AI'];
const types = ['thought', 'decision', 'execution', 'alert', 'success'];
const messages = {
  thought: ['Analyzing occupancy patterns...', 'Evaluating guest preferences', 'Considering pricing strategy'],
  decision: ['Adjusting weekend rates +$22', 'Assigning housekeeping to room 206', 'Offering suite upgrade'],
  execution: ['Sent upgrade offer to guest', 'Updated room status to cleaning', 'Triggered maintenance ticket'],
  alert: ['AC failure detected in Room 206', 'Checkout overdue for Room 211', 'Guest complaint: noisy neighbor'],
  success: ['Room 207 cleaned successfully', 'Upgrade accepted by VIP guest', 'Revenue target met +8%'],
};

server.on('connection', (ws) => {
  console.log('Client connected to mock WebSocket');
  const interval = setInterval(() => {
    const agent = agents[Math.floor(Math.random() * agents.length)];
    const type = types[Math.floor(Math.random() * types.length)];
    const msg = messages[type][Math.floor(Math.random() * messages[type].length)];
    ws.send(JSON.stringify({
      type,
      agent,
      message: msg,
      details: type === 'decision' ? 'Action taken automatically' : '',
      timestamp: new Date().toISOString(),
    }));
  }, 3000);

  ws.on('close', () => {
    clearInterval(interval);
    console.log('Client disconnected');
  });
});

console.log('Mock WebSocket server running on ws://localhost:8080');