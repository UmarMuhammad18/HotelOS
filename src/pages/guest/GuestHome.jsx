import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import useAuthStore from '../../stores/useAuthStore';
import { API_BASE } from '../../config';

export default function GuestHome() {
  const { user } = useAuthStore();
  const [hotelInfo, setHotelInfo] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/guest/hotel-info`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('hotelos_token')}` }
    })
    .then(res => res.json())
    .then(data => setHotelInfo(data));
  }, []);

  return (
    <div className="guest-home">
      <style>{`
        .welcome-section {
          margin-bottom: 30px;
        }
        h1 { font-size: 28px; margin-bottom: 8px; }
        .subtitle { color: #8892a4; font-size: 15px; }

        .info-card {
          background: #0e1117;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 24px;
        }

        .quick-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 30px;
        }

        .action-card {
          background: #0e1117;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 16px;
          text-align: center;
          text-decoration: none;
          color: inherit;
        }

        .action-icon { font-size: 24px; margin-bottom: 8px; display: block; }
        .action-label { font-size: 13px; font-weight: 600; }

        .amenity-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .amenity-item {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
        }
      `}</style>

      <motion.div 
        className="welcome-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1>Welcome, {user?.name?.split(' ')[0]}</h1>
        <p className="subtitle">Room {user?.room_number || '104'} • {hotelInfo?.name || 'HotelOS Grand'}</p>
      </motion.div>

      <div className="quick-actions">
        <Link to="/guest/requests" className="action-card">
          <span className="action-icon">🛎️</span>
          <span className="action-label">Request Service</span>
        </Link>
        <Link to="/guest/offers" className="action-card">
          <span className="action-icon">🎁</span>
          <span className="action-label">Special Offers</span>
        </Link>
        <Link to="/guest/bill" className="action-card">
          <span className="action-icon">🧾</span>
          <span className="action-label">View My Bill</span>
        </Link>
        <Link to="/guest/profile" className="action-card">
          <span className="action-icon">⚙️</span>
          <span className="action-label">Preferences</span>
        </Link>
      </div>

      <div className="info-card">
        <h3 style={{ marginBottom: 16 }}>Hotel Information</h3>
        <div className="amenity-list">
          <div className="amenity-item">
            <span>Wi-Fi Network</span>
            <span style={{ color: '#f5a623' }}>{hotelInfo?.wifi?.split(' / ')[0]}</span>
          </div>
          <div className="amenity-item">
            <span>Wi-Fi Password</span>
            <span style={{ color: '#f5a623' }}>{hotelInfo?.wifi?.split(' / ')[1]}</span>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)' }} />
          {hotelInfo?.amenities.map((a, i) => (
            <div className="amenity-item" key={i}>
              <span>{a.name}</span>
              <span style={{ color: '#8892a4' }}>{a.hours}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
