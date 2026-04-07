import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// API base URL – change to your actual backend
const API_BASE = 'http://localhost:8080/api';

export default function ControlPanel() {
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Available event types to inject
  const eventTypes = [
    { value: 'late_arrival', label: '🚗 Late Guest Arrival' },
    { value: 'room_issue', label: '🔧 Room Issue (AC failure)' },
    { value: 'vip_guest', label: '👑 VIP Guest Check-in' },
    { value: 'staff_shortage', label: '👥 Staff Shortage Alert' },
    { value: 'overbooking', label: '📊 Overbooking Situation' },
    { value: 'early_checkout', label: '🏃 Early Checkout Request' },
  ];

  // Helper to call API
  const callApi = async (endpoint, method = 'POST', body = null) => {
    setIsLoading(true);
    try {
      const options = { method, headers: { 'Content-Type': 'application/json' } };
      if (body) options.body = JSON.stringify(body);
      const response = await fetch(`${API_BASE}${endpoint}`, options);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      setMessage(`✅ ${endpoint} successful`);
      setTimeout(() => setMessage(''), 3000);
      return data;
    } catch (error) {
      console.error(error);
      setMessage(`❌ Failed: ${endpoint}`);
      setTimeout(() => setMessage(''), 3000);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleStart = async () => {
    const result = await callApi('/simulation/start');
    if (result) setIsRunning(true);
  };

  const handleStop = async () => {
    const result = await callApi('/simulation/stop');
    if (result) setIsRunning(false);
  };

  const handleInjectEvent = async () => {
    if (!selectedEvent) {
      setMessage('⚠️ Please select an event first');
      setTimeout(() => setMessage(''), 2000);
      return;
    }
    await callApi('/simulation/event', 'POST', { eventType: selectedEvent });
    setSelectedEvent('');
  };

  const handleSpeedChange = async (newSpeed) => {
    setSpeed(newSpeed);
    await callApi('/simulation/speed', 'PUT', { speed: newSpeed });
  };

  const handleReset = async () => {
    if (window.confirm('Reset entire simulation? All current state will be lost.')) {
      await callApi('/simulation/reset');
      setIsRunning(false);
      setSpeed(1.0);
    }
  };

  return (
    <div style={{
      background: '#0e1117',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 16,
      padding: '20px',
      marginBottom: 24,
    }}>
      <div style={{ fontSize: 14, fontFamily: "'Space Mono', monospace", color: '#f5a623', marginBottom: 16, letterSpacing: '0.1em' }}>
        🎮 SIMULATION CONTROL CENTER
      </div>

      {/* Status message */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'rgba(0,0,0,0.6)',
            padding: '8px 12px',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 12,
            color: message.includes('✅') ? '#4ade80' : message.includes('❌') ? '#f87171' : '#f5a623',
          }}
        >
          {message}
        </motion.div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        {/* Start button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleStart}
          disabled={isRunning || isLoading}
          style={{
            background: isRunning ? '#1a2a1a' : '#2dd4bf20',
            border: `1px solid ${isRunning ? '#2dd4bf' : '#2dd4bf80'}`,
            borderRadius: 10,
            padding: '10px 16px',
            color: '#2dd4bf',
            fontFamily: "'Space Mono', monospace",
            fontSize: 12,
            fontWeight: 700,
            cursor: isRunning ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          ▶️ {isRunning ? 'RUNNING' : 'START SIMULATION'}
        </motion.button>

        {/* Stop button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleStop}
          disabled={!isRunning || isLoading}
          style={{
            background: !isRunning ? '#2a1a1a' : '#f8717120',
            border: `1px solid ${!isRunning ? '#f87171' : '#f8717180'}`,
            borderRadius: 10,
            padding: '10px 16px',
            color: '#f87171',
            fontFamily: "'Space Mono', monospace",
            fontSize: 12,
            fontWeight: 700,
            cursor: !isRunning ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          ⏹️ STOP SIMULATION
        </motion.button>

        {/* Reset button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleReset}
          disabled={isLoading}
          style={{
            background: '#f5a62320',
            border: '1px solid #f5a62380',
            borderRadius: 10,
            padding: '10px 16px',
            color: '#f5a623',
            fontFamily: "'Space Mono', monospace",
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          🔄 RESET SYSTEM
        </motion.button>
      </div>

      {/* Inject event row */}
      <div style={{ marginTop: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={selectedEvent}
          onChange={(e) => setSelectedEvent(e.target.value)}
          style={{
            flex: 2,
            background: '#0c0f16',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '10px 12px',
            color: '#e8eaf0',
            fontFamily: "'Space Mono', monospace",
            fontSize: 12,
          }}
        >
          <option value="">-- Inject an event --</option>
          {eventTypes.map(ev => (
            <option key={ev.value} value={ev.value}>{ev.label}</option>
          ))}
        </select>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleInjectEvent}
          disabled={!selectedEvent || isLoading}
          style={{
            flex: 1,
            background: '#60a5fa20',
            border: '1px solid #60a5fa80',
            borderRadius: 10,
            padding: '10px 16px',
            color: '#60a5fa',
            fontFamily: "'Space Mono', monospace",
            fontSize: 12,
            fontWeight: 700,
            cursor: (!selectedEvent || isLoading) ? 'not-allowed' : 'pointer',
          }}
        >
          🔔 INJECT EVENT
        </motion.button>
      </div>

      {/* Speed slider */}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: '#8892a4' }}>SIMULATION SPEED</span>
          <span style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", color: '#f5a623' }}>{speed.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min={0.5}
          max={5.0}
          step={0.1}
          value={speed}
          onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
          disabled={isLoading}
          style={{
            width: '100%',
            background: '#1c2230',
            height: 4,
            borderRadius: 2,
            WebkitAppearance: 'none',
          }}
        />
        <style>{`
          input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #f5a623;
            cursor: pointer;
          }
        `}</style>
      </div>
    </div>
  );
}