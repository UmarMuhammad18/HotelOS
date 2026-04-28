const { WebSocketServer } = require('ws');
const url = require('url');
const { callAgent } = require('./services/aiClient');

let feedClients = new Set();
let chatClients = new Set();
let broadcastFeedFn = null;

function initWebSockets(server, broadcastFeed) {
  const wssFeed = new WebSocketServer({ noServer: true });
  const wssChat = new WebSocketServer({ noServer: true });
  broadcastFeedFn = broadcastFeed;

  wssFeed.on('connection', (ws) => {
    feedClients.add(ws);
    ws.send(JSON.stringify({ 
      type: 'success', 
      agent: 'Orchestrator', 
      message: 'HotelOS backend connected — all systems operational', 
      details: '', 
      timestamp: new Date().toISOString() 
    }));
    ws.on('close', () => feedClients.delete(ws));
    ws.on('error', () => feedClients.delete(ws));
  });

  wssChat.on('connection', (ws) => {
    chatClients.add(ws);
    ws.on('message', async (raw) => {
      let text = '';
      try { const msg = JSON.parse(raw.toString()); text = msg.message ?? msg.text ?? ''; }
      catch { text = raw.toString(); }

      if (text) {
        // 1. Broadcast that staff sent a message
        if (broadcastFeedFn) {
          broadcastFeedFn({ 
            type: 'thought', 
            agent: 'Staff Chat', 
            message: `Staff query: "${text.slice(0, 200)}"`, 
            details: '' 
          });
        }

        // 2. Call the Python AI Service
        const aiResponse = await callAgent(text, { source: 'staff_chat' });

        // 3. Broadcast AI's internal "thought" to the activity feed
        if (broadcastFeedFn) {
          broadcastFeedFn({
            type: 'thought',
            agent: aiResponse.agent,
            message: aiResponse.thought,
            details: aiResponse.action
          });
        }

        // 4. Send AI's final response back to the chat client
        ws.send(JSON.stringify({ 
          message: aiResponse.response, 
          agent: aiResponse.agent,
          timestamp: new Date().toISOString() 
        }));
      }
    });
    ws.on('close', () => chatClients.delete(ws));
    ws.on('error', () => chatClients.delete(ws));
  });

  server.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;
    if (pathname === '/chat') {
      wssChat.handleUpgrade(request, socket, head, (ws) => wssChat.emit('connection', ws, request));
    } else {
      wssFeed.handleUpgrade(request, socket, head, (ws) => wssFeed.emit('connection', ws, request));
    }
  });

  return { feedClients, chatClients };
}

function broadcastFeed(obj) {
  const payload = JSON.stringify({ ...obj, timestamp: obj.timestamp || new Date().toISOString() });
  for (const ws of feedClients) {
    if (ws.readyState === 1) ws.send(payload);
  }
}

module.exports = {
  initWebSockets,
  broadcastFeed
};

