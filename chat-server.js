const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });

// Simple command responses
const responses = {
  'ac': 'I have notified maintenance for the AC issue. A technician will be sent shortly.',
  'late': 'I will arrange a late checkout notification for the guest.',
  'upgrade': 'Checking room availability for upgrade... Suite 507 is available at +$80/night. Shall I send the offer?',
  'housekeeping': 'Housekeeping has been dispatched to the requested room.',
  'default': 'I understand your request. Our agent system is processing it now. Is there anything else I can help with?'
};

server.on('connection', (ws) => {
  console.log('Chat client connected');

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    console.log('Received:', msg.message);

    // Simulate thinking
    setTimeout(() => {
      let reply = responses.default;
      const lowerMsg = msg.message.toLowerCase();
      if (lowerMsg.includes('ac') || lowerMsg.includes('cooling')) reply = responses.ac;
      else if (lowerMsg.includes('late') || lowerMsg.includes('checkout')) reply = responses.late;
      else if (lowerMsg.includes('upgrade') || lowerMsg.includes('suite')) reply = responses.upgrade;
      else if (lowerMsg.includes('clean') || lowerMsg.includes('housekeeping')) reply = responses.housekeeping;

      ws.send(JSON.stringify({ message: reply, timestamp: new Date().toISOString() }));
    }, 1000);
  });
});

console.log('Chat WebSocket server running on ws://localhost:8080');