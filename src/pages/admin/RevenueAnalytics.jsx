import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function RevenueAnalytics() {
  const [breakdown, setBreakdown] = useState([]);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL || ''}/api/admin/revenue/breakdown`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('hotelos_token')}` }
    })
    .then(res => res.json())
    .then(setBreakdown);
  }, []);

  const COLORS = ['#f5a623', '#2dd4bf', '#60a5fa', '#f87171'];

  return (
    <div className="revenue-analytics">
      <style>{`
        .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 32px; }
        .chart-card { background: #0e1117; border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; }
      `}</style>

      <h1>Revenue Analytics</h1>

      <div className="chart-grid">
        <div className="chart-card">
          <h3 style={{ marginBottom: 24 }}>Revenue by Source</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={breakdown}>
                <CartesianGrid stroke="#1c2230" strokeDasharray="3 3" />
                <XAxis dataKey="source" stroke="#4e5a6e" />
                <YAxis stroke="#4e5a6e" />
                <Tooltip contentStyle={{ background: '#0e1117', border: '1px solid #f5a623' }} />
                <Bar dataKey="amount" fill="#f5a623" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <h3 style={{ marginBottom: 24 }}>Distribution</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={breakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="amount"
                  nameKey="source"
                >
                  {breakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#0e1117', border: '1px solid #f5a623' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
