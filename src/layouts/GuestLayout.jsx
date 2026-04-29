import { Outlet, Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/useAuthStore';
import ConnectionStatus from '../components/ConnectionStatus';

export default function GuestLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="guest-layout">
      <style>{`
        .guest-layout {
          min-height: 100vh;
          background: #090b0f;
          color: #e8eaf0;
          font-family: 'Outfit', sans-serif;
        }

        .guest-top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          height: 64px;
          background: #0e1117;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .guest-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #f5a623;
          text-decoration: none;
          font-weight: 700;
        }

        .guest-nav {
          display: flex;
          background: #0e1117;
          border-top: 1px solid rgba(255, 255, 255, 0.07);
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 70px;
          justify-content: space-around;
          align-items: center;
          padding-bottom: env(safe-area-inset-bottom);
        }

        .guest-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          color: #8892a4;
          text-decoration: none;
          font-size: 11px;
          transition: all 0.2s;
        }

        .guest-nav-item.active {
          color: #f5a623;
        }

        .guest-nav-icon {
          font-size: 20px;
        }

        .guest-content {
          padding: 20px;
          padding-bottom: 100px;
        }

        .user-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.05);
          padding: 4px 12px;
          border-radius: 100px;
          font-size: 13px;
        }

        .logout-btn {
          background: transparent;
          border: none;
          color: #f87171;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
        }
      `}</style>

      <header className="guest-top-bar">
        <Link to="/guest/home" className="guest-logo">
          <div style={{
            width: 20,
            height: 20,
            background: '#f5a623',
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
          }} />
          <span>GUEST PLATFORM</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ConnectionStatus />
          <div className="user-chip">
            <span>{user?.name}</span>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </div>
        </div>
      </header>

      <main className="guest-content">
        <Outlet />
      </main>

      <nav className="guest-nav">
        <Link to="/guest/home" className={`guest-nav-item ${window.location.pathname === '/guest/home' ? 'active' : ''}`}>
          <span className="guest-nav-icon">🏠</span>
          <span>Home</span>
        </Link>
        <Link to="/guest/requests" className={`guest-nav-item ${window.location.pathname === '/guest/requests' ? 'active' : ''}`}>
          <span className="guest-nav-icon">🛎️</span>
          <span>Requests</span>
        </Link>
        <Link to="/guest/offers" className={`guest-nav-item ${window.location.pathname === '/guest/offers' ? 'active' : ''}`}>
          <span className="guest-nav-icon">🎁</span>
          <span>Offers</span>
        </Link>
        <Link to="/guest/bill" className={`guest-nav-item ${window.location.pathname === '/guest/bill' ? 'active' : ''}`}>
          <span className="guest-nav-icon">💳</span>
          <span>Bill</span>
        </Link>
        <Link to="/guest/profile" className={`guest-nav-item ${window.location.pathname === '/guest/profile' ? 'active' : ''}`}>
          <span className="guest-nav-icon">👤</span>
          <span>Profile</span>
        </Link>
      </nav>
    </div>
  );
}
