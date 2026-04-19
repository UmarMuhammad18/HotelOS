import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CHAT_WS_URL } from '../config';

// Message bubble component
function MessageBubble({ message, isUser }) {
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 16,
      }}
    >
      <div style={{
        maxWidth: '70%',
        background: isUser ? '#f5a62320' : '#0e1117',
        border: isUser ? '1px solid #f5a62340' : '1px solid rgba(255,255,255,0.07)',
        borderRadius: 18,
        padding: '10px 16px',
        position: 'relative',
      }}>
        <div style={{ fontSize: 13, color: '#e8eaf0', wordWrap: 'break-word' }}>
          {message.text}
        </div>
        <div style={{
          fontSize: 9,
          fontFamily: "'Space Mono', monospace",
          color: '#4e5a6e',
          marginTop: 4,
          textAlign: 'right',
        }}>
          {time}
        </div>
      </div>
    </motion.div>
  );
}

// Typing indicator
function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}
    >
      <div style={{
        background: '#0e1117',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 18,
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
        <span style={{ width: 6, height: 6, background: '#f5a623', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both' }} />
        <span style={{ width: 6, height: 6, background: '#f5a623', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both 0.2s' }} />
        <span style={{ width: 6, height: 6, background: '#f5a623', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both 0.4s' }} />
        <style>{`
          @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
          }
        `}</style>
        <span style={{ fontSize: 11, color: '#8892a4', marginLeft: 4 }}>Agent is typing...</span>
      </div>
    </motion.div>
  );
}

function StaffChat({ wsUrl = CHAT_WS_URL }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: 'Connected to HotelOS assistant. How can I help you?',
        isUser: false,
        timestamp: new Date().toISOString(),
      }]);
    };

    ws.onmessage = (event) => {
      setIsTyping(false);
      try {
        const data = JSON.parse(event.data);
        setMessages(prev => [...prev, {
          id: Date.now(),
          text: data.message || data.reply || 'I received your message.',
          isUser: false,
          timestamp: new Date().toISOString(),
        }]);
      } catch (e) {
        console.error('Failed to parse message', e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [wsUrl]);

  const sendMessage = () => {
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const userMessage = {
      id: Date.now(),
      text: input,
      isUser: true,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    wsRef.current.send(JSON.stringify({
      type: 'chat',
      message: input,
      timestamp: new Date().toISOString(),
    }));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#0c0f16',
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.07)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: '#0e1117',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{ fontSize: 20 }}>💬</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0' }}>Staff Assistant</div>
          <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: isConnected ? '#4ade80' : '#f87171' }}>
            {isConnected ? '● Connected' : '○ Disconnected'}
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <AnimatePresence>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} isUser={msg.isUser} />
          ))}
        </AnimatePresence>
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        background: '#0e1117',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
      }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask the AI assistant... (e.g., 'Room 206 AC is broken')"
          rows={1}
          style={{
            flex: 1,
            background: '#0c0f16',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20,
            padding: '10px 16px',
            color: '#e8eaf0',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            resize: 'none',
            outline: 'none',
          }}
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={sendMessage}
          disabled={!input.trim() || !isConnected}
          style={{
            background: '#f5a623',
            border: 'none',
            borderRadius: 20,
            padding: '8px 20px',
            color: '#090b0f',
            fontFamily: "'Space Mono', monospace",
            fontSize: 11,
            fontWeight: 700,
            cursor: (!input.trim() || !isConnected) ? 'not-allowed' : 'pointer',
            opacity: (!input.trim() || !isConnected) ? 0.5 : 1,
          }}
        >
          SEND
        </motion.button>
      </div>
    </div>
  );
}

export default StaffChat;