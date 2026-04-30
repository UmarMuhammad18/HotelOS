import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import ConnectionStatus from './components/ConnectionStatus';
import EventAnimationTrigger from './components/EventAnimationTrigger';
import NotificationCenter from './components/NotificationCenter';
import { useWebSocketClient } from './hooks/useWebSocketClient';
import { WS_URL } from './config';
import { useDarkMode } from './hooks/useDarkMode';
import useAuthStore from './stores/useAuthStore';

export default function DashboardLayout() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useDarkMode();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  
  useWebSocketClient(WS_URL);

  const isActive = (path, isFullPath = false) => {
    if (isFullPath) {
      return location.pathname === path;
    }
    if (user?.role === 'admin') {
      return location.pathname === `/admin${path}` || location.pathname === `/dashboard${path}`;
    }
    return location.pathname === `/dashboard${path}`;
  };

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.ctrlKey && e.key === 'm') navigate('/dashboard/map');
      else if (e.ctrlKey && e.key === 't') navigate('/dashboard/tasks');
      else if (e.ctrlKey && e.key === 'a') navigate('/dashboard/agents');
      else if (e.ctrlKey && e.key === 'h') navigate(user?.role === 'admin' ? '/admin' : '/dashboard');
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigate, user?.role]);

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  const handleLogout = () => {
    logout();
    navigate('/?login=1', { replace: true });
  };

  return (
    <div className="dashboard-container">
      <style>{`
        .dashboard-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #090b0f;
          color: #e8eaf0;
          font-family: 'Outfit', sans-serif;
        }

        .top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          height: 64px;
          background: #0e1117;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          z-index: 100;
        }

        .logo-section {
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: #f5a623;
          text-decoration: none;
        }

        .menu-toggle {
          display: none;
          background: none;
          border: none;
          color: #fff;
          font-size: 24px;
          cursor: pointer;
          padding: 8px;
        }

        .main-layout {
          display: flex;
          flex: 1;
          overflow: hidden;
          position: relative;
        }

        .sidebar {
          width: 260px;
          background: #0c0f16;
          border-right: 1px solid rgba(255, 255, 255, 0.07);
          padding: 24px 0;
          transition: transform 0.3s ease;
          z-index: 90;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 24px;
          color: #8892a4;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
          border-left: 3px solid transparent;
        }

        .nav-link:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.02);
        }

        .nav-link.active {
          color: #f5a623;
          background: rgba(245, 166, 35, 0.08);
          border-left-color: #f5a623;
        }

        .content-area {
          flex: 1;
          overflow: auto;
          padding: 32px;
          background: radial-gradient(circle at top right, rgba(245, 166, 35, 0.03), transparent);
        }

        .overlay {
          display: none;
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          z-index: 85;
        }

        @media (max-width: 1024px) {
          .sidebar {
            position: absolute;
            top: 0;
            bottom: 0;
            left: 0;
            transform: translateX(-100%);
          }

          .sidebar.open {
            transform: translateX(0);
          }

          .menu-toggle {
            display: block;
          }

          .overlay.open {
            display: block;
          }

          .content-area {
            padding: 20px;
          }
        }
      `}</style>

      <EventAnimationTrigger />
      
      <header className="top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="menu-toggle" onClick={() => setSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? '✕' : '☰'}
          </button>
          <Link to="/" className="logo-section">
            <div style={{
              width: 24,
              height: 24,
              background: '#f5a623',
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
            }} />
            <span>HOTELOS</span>
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <NotificationCenter />
          <ConnectionStatus />
          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              color: '#e8eaf0',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 12px',
            }}
          >
            Switch User
          </button>
          <button
            onClick={() => setIsDark(!isDark)}
            style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', color: '#fff' }}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <div className="main-layout">
        <div className={`overlay ${isSidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
        
        <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
          {user?.role === 'admin' ? (
            <>
              <Link to="/admin" className={`nav-link ${isActive('/admin', true) ? 'active' : ''}`}>
                <span>📊</span> Admin Overview
              </Link>
              <Link to="/admin/revenue" className={`nav-link ${isActive('/admin/revenue', true) ? 'active' : ''}`}>
                <span>💰</span> Revenue Analytics
              </Link>
              <Link to="/admin/reviews" className={`nav-link ${isActive('/admin/reviews', true) ? 'active' : ''}`}>
                <span>⭐</span> Reviews Manager
              </Link>
              <Link to="/admin/departments" className={`nav-link ${isActive('/admin/departments', true) ? 'active' : ''}`}>
                <span>🏢</span> Department Overview
              </Link>
              <Link to="/admin/system" className={`nav-link ${isActive('/admin/system', true) ? 'active' : ''}`}>
                <span>⚙️</span> System Health
              </Link>
              <Link to="/admin/issues" className={`nav-link ${isActive('/admin/issues', true) ? 'active' : ''}`}>
                <span>🔧</span> Issues Resolved
              </Link>
              <Link to="/dashboard/agents" className={`nav-link ${isActive('/dashboard/agents', true) ? 'active' : ''}`}>
                <span>🤖</span> Agents
              </Link>
              <Link to="/dashboard" className={`nav-link ${isActive('/dashboard', true) ? 'active' : ''}`}>
                <span>🏠</span> Manager Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link to="/dashboard" className={`nav-link ${isActive('') ? 'active' : ''}`}>
                <span>🏠</span> Dashboard Home
              </Link>
              <Link to="/dashboard/map" className={`nav-link ${isActive('/map') ? 'active' : ''}`}>
                <span>🗺️</span> Hotel Map
              </Link>
              <Link to="/dashboard/agents" className={`nav-link ${isActive('/agents') ? 'active' : ''}`}>
                <span>🤖</span> Agents
              </Link>
              <Link to="/dashboard/chat" className={`nav-link ${isActive('/chat') ? 'active' : ''}`}>
                <span>💬</span> Staff Chat
              </Link>
              <Link to="/dashboard/tasks" className={`nav-link ${isActive('/tasks') ? 'active' : ''}`}>
                <span>📋</span> Task Board
              </Link>
              
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '16px 0', paddingTop: '16px' }}>
                <div style={{ paddingLeft: '24px', fontSize: '12px', color: '#666', marginBottom: '8px', fontWeight: '600' }}>DEPARTMENTS</div>
                <Link to="/dashboard/department/concierge" className={`nav-link ${isActive('/department/concierge') ? 'active' : ''}`}>
                  <span>🎩</span> Concierge
                </Link>
                <Link to="/dashboard/department/food_beverage" className={`nav-link ${isActive('/department/food_beverage') ? 'active' : ''}`}>
                  <span>🍽️</span> Food & Beverage
                </Link>
                <Link to="/dashboard/department/housekeeping" className={`nav-link ${isActive('/department/housekeeping') ? 'active' : ''}`}>
                  <span>🧹</span> Housekeeping
                </Link>
                <Link to="/dashboard/department/maintenance" className={`nav-link ${isActive('/department/maintenance') ? 'active' : ''}`}>
                  <span>🔧</span> Maintenance
                </Link>
                <Link to="/dashboard/department/front_office" className={`nav-link ${isActive('/department/front_office') ? 'active' : ''}`}>
                  <span>🛎️</span> Front Office
                </Link>
                <Link to="/dashboard/department/guest_relations" className={`nav-link ${isActive('/department/guest_relations') ? 'active' : ''}`}>
                  <span>🤝</span> Guest Relations
                </Link>
                <Link to="/dashboard/department/guest_experience" className={`nav-link ${isActive('/department/guest_experience') ? 'active' : ''}`}>
                  <span>⭐</span> Guest Experience
                </Link>
              </div>
            </>
          )}
        </aside>

        <main className="content-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
