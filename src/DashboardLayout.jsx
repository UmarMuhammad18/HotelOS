import { Outlet, Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import ConnectionStatus from './components/ConnectionStatus';
import EventAnimationTrigger from './components/EventAnimationTrigger';
import NotificationCenter from './components/NotificationCenter';
import { useWebSocketClient } from './hooks/useWebSocketClient';
import { WS_URL } from './config';
import { useDarkMode } from './hooks/useDarkMode';

const topBarStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 20px',
  height: '56px',
  background: '#0e1117',
  borderBottom: '1px solid rgba(255,255,255,0.07)',
};

const logoStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  fontFamily: "'Space Mono', monospace",
  fontWeight: 700,
  fontSize: '14px',
  letterSpacing: '0.12em',
  color: '#f5a623',
};

const sidebarStyles = {
  width: '240px',
  background: '#0c0f16',
  borderRight: '1px solid rgba(255,255,255,0.07)',
  padding: '20px 0',
};

const navLinkStyles = {
  display: 'block',
  padding: '10px 20px',
  color: '#8892a4',
  textDecoration: 'none',
  fontFamily: "'Space Mono', monospace",
  fontSize: '12px',
  transition: 'all 0.2s',
};

const activeLinkStyles = {
  ...navLinkStyles,
  color: '#f5a623',
  background: 'rgba(245,166,35,0.08)',
  borderRight: '2px solid #f5a623',
};

function TopBar() {
  const [isDark, setIsDark] = useDarkMode();

  return (
    <div style={topBarStyles}>
      <div style={logoStyles}>
        <div style={{
          width: 24,
          height: 24,
          background: '#f5a623',
          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
        }} />
        <span>HOTELOS</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <NotificationCenter />
        <ConnectionStatus />
        <button
          onClick={() => setIsDark(!isDark)}
          style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer' }}
        >
          {isDark ? '☀️' : '🌙'}
        </button>
      </div>
    </div>
  );
}

function Sidebar() {
  const location = useLocation();
  const isActive = (path) => location.pathname === `/dashboard${path}`;

  return (
    <div style={sidebarStyles}>
      <Link to="/dashboard" style={isActive('') ? activeLinkStyles : navLinkStyles}>
        🏠 Dashboard Home
      </Link>
      <Link to="/dashboard/map" style={isActive('/map') ? activeLinkStyles : navLinkStyles}>
        🗺️ Hotel Map
      </Link>
      <Link to="/dashboard/agents" style={isActive('/agents') ? activeLinkStyles : navLinkStyles}>
        🤖 Agents
      </Link>
      <Link to="/dashboard/chat" style={isActive('/chat') ? activeLinkStyles : navLinkStyles}>
        💬 Staff Chat
      </Link>
      <Link to="/dashboard/tasks" style={isActive('/tasks') ? activeLinkStyles : navLinkStyles}>
        📋 Task Board
      </Link>
    </div>
  );
}

export default function DashboardLayout() {
  useWebSocketClient(WS_URL);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.ctrlKey && e.key === 'm') {
        window.location.href = '/dashboard/map';
      } else if (e.ctrlKey && e.key === 't') {
        window.location.href = '/dashboard/tasks';
      } else if (e.ctrlKey && e.key === 'a') {
        window.location.href = '/dashboard/agents';
      } else if (e.ctrlKey && e.key === 'h') {
        window.location.href = '/dashboard';
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#090b0f' }}>
      <EventAnimationTrigger />
      <TopBar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}