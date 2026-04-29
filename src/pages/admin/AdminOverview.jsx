import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { API_BASE } from '../../config';

export default function AdminOverview() {
  const [metrics, setMetrics] = useState(null);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('hotelos_token');
    const headers = { 'Authorization': `Bearer ${token}` };
    
    fetch(`${API_BASE}/api/admin/dashboard/metrics`, { headers })
      .then(res => res.json())
      .then(setMetrics);
      
    fetch(`${API_BASE}/api/admin/reviews?limit=3`, { headers })
      .then(res => res.json())
      .then(setReviews);
  }, []);

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.5 }
    })
  };

  return (
    <div className="admin-overview">
      <style>{`
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }
        .stat-card {
          background: #0e1117;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 24px;
        }
        .stat-label { font-size: 12px; color: #8892a4; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .stat-value { font-size: 32px; font-weight: 700; color: #f5a623; font-family: 'Space Mono', monospace; }
        
        .admin-main-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
        }
        .content-box {
          background: #0e1117;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 24px;
        }
        .review-item {
          padding: 16px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .rating-stars { color: #f5a623; margin-bottom: 4px; }
      `}</style>

      <h1 style={{ marginBottom: 24 }}>Manager Dashboard</h1>

      <div className="metrics-grid">
        {[
          { label: 'Total Revenue', value: `$${metrics?.revenue?.toLocaleString() || '0'}` },
          { label: 'Occupancy Rate', value: `${(metrics?.occupancyRate * 100 || 0).toFixed(1)}%` },
          { label: 'ADR', value: `$${metrics?.adr || '0'}` },
          { label: 'RevPAR', value: `$${metrics?.revPar || '0'}` }
        ].map((s, i) => (
          <motion.div key={i} className="stat-card" variants={cardVariants} initial="hidden" animate="visible" custom={i}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="admin-main-grid">
        <div className="content-box">
          <h3 style={{ marginBottom: 20 }}>Revenue Trend</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[
                { name: 'Mon', rev: 4000 }, { name: 'Tue', rev: 3000 }, { name: 'Wed', rev: 5000 },
                { name: 'Thu', rev: 4500 }, { name: 'Fri', rev: 7000 }, { name: 'Sat', rev: 8500 }, { name: 'Sun', rev: 6000 }
              ]}>
                <CartesianGrid stroke="#1c2230" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#4e5a6e" />
                <YAxis stroke="#4e5a6e" />
                <Tooltip contentStyle={{ background: '#0e1117', border: '1px solid #f5a623' }} />
                <Line type="monotone" dataKey="rev" stroke="#f5a623" strokeWidth={3} dot={{ fill: '#f5a623' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="content-box">
          <h3 style={{ marginBottom: 20 }}>Recent Reviews</h3>
          <div className="reviews-list">
            {reviews.map((r, i) => (
              <div key={i} className="review-item">
                <div className="rating-stars">{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</div>
                <div style={{ fontSize: 13, marginBottom: 4 }}>"{r.comment}"</div>
                <div style={{ fontSize: 11, color: '#8892a4' }}>Guest {r.guest_name} • Room {r.room_number || 'N/A'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
