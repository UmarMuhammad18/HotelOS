import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import useAuthStore from '../../stores/useAuthStore';
import { API_BASE } from '../../config';

export default function GuestProfile() {
  const { user } = useAuthStore();
  const [preferences, setPreferences] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/guest/profile`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('hotelos_token')}` }
    })
    .then(res => res.json())
    .then(data => {
      setPreferences(data.preferences || {});
      setLoading(false);
    });
  }, []);

  const handleUpdate = async (key, value) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    try {
      await fetch(`${API_BASE}/api/guest/profile`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hotelos_token')}` 
        },
        body: JSON.stringify(updated)
      });
      toast.success('Preference updated');
    } catch (err) {
      toast.error('Failed to update preference');
    }
  };

  return (
    <div className="guest-profile">
      <style>{`
        h2 { margin-bottom: 24px; }
        .pref-section {
          background: #0e1117;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
        }
        .pref-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .pref-info h4 { margin-bottom: 4px; }
        .pref-info p { font-size: 12px; color: #8892a4; }
        select {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          padding: 8px;
          border-radius: 6px;
        }
      `}</style>

      <h2>Stay Preferences</h2>

      {loading ? <p>Loading profile...</p> : (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="pref-section">
            <div className="pref-item">
              <div className="pref-info">
                <h4>Pillow Type</h4>
                <p>Choose your preferred comfort level</p>
              </div>
              <select 
                value={preferences.pillow || 'standard'} 
                onChange={(e) => handleUpdate('pillow', e.target.value)}
              >
                <option value="standard">Standard</option>
                <option value="firm">Firm</option>
                <option value="soft">Soft</option>
                <option value="memory_foam">Memory Foam</option>
              </select>
            </div>

            <div className="pref-item">
              <div className="pref-info">
                <h4>Room Temperature</h4>
                <p>Default target temperature for your room</p>
              </div>
              <select 
                value={preferences.temp || '22'} 
                onChange={(e) => handleUpdate('temp', e.target.value)}
              >
                <option value="18">18°C (Cool)</option>
                <option value="20">20°C</option>
                <option value="22">22°C (Comfort)</option>
                <option value="24">24°C (Warm)</option>
              </select>
            </div>

            <div className="pref-item">
              <div className="pref-info">
                <h4>Newspaper</h4>
                <p>Delivered to your door each morning</p>
              </div>
              <select 
                value={preferences.newspaper || 'none'} 
                onChange={(e) => handleUpdate('newspaper', e.target.value)}
              >
                <option value="none">None</option>
                <option value="FT">Financial Times</option>
                <option value="WSJ">Wall Street Journal</option>
                <option value="NYT">New York Times</option>
              </select>
            </div>
          </div>

          <div className="pref-section">
            <h3 style={{ marginBottom: 16 }}>Personal Details</h3>
            <div className="pref-item">
              <div className="pref-info">
                <h4>Name</h4>
                <p>{user?.name}</p>
              </div>
            </div>
            <div className="pref-item">
              <div className="pref-info">
                <h4>Booking Confirmation</h4>
                <p style={{ fontFamily: 'monospace', color: '#f5a623' }}>BK-8271</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
