import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';

// Mock guest data – in production, fetch from API
const mockGuests = {
  'James Harrington': {
    name: 'James Harrington',
    room: '204',
    status: 'checked-in',
    checkIn: '2026-04-05',
    checkOut: '2026-04-10',
    preferences: ['Extra pillows', 'Late checkout requested', 'VIP status'],
    requests: [
      { date: '2026-04-06', message: 'Requested extra towels', resolved: true },
      { date: '2026-04-07', message: 'Complained about noise', resolved: false },
    ],
    totalSpent: 1250,
  },
  'Amara Diallo': {
    name: 'Amara Diallo',
    room: '208',
    status: 'VIP',
    checkIn: '2026-04-06',
    checkOut: '2026-04-09',
    preferences: ['Suite upgrade', 'Champagne on arrival', 'Late checkout'],
    requests: [
      { date: '2026-04-06', message: 'Requested suite upgrade', resolved: true },
    ],
    totalSpent: 3400,
  },
};

export default function GuestProfile() {
  const { name } = useParams();
  const [guest, setGuest] = useState(null);

  useEffect(() => {
    // In production, fetch from API
    setGuest(mockGuests[decodeURIComponent(name)] || null);
  }, [name]);

  if (!guest) {
    return <div style={{ padding: 20, color: '#8892a4' }}>Guest not found</div>;
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <style>{`
        .guest-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .guest-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 24px;
        }
        @media (max-width: 640px) {
          .guest-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          .guest-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <h1 style={{ fontSize: 24, fontFamily: "'Space Mono', monospace", color: '#e8eaf0', marginBottom: 20 }}>
        Guest Profile
      </h1>
      <div style={{
        background: '#0e1117',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
        padding: 24,
      }}>
        <div className="guest-header">
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#e8eaf0' }}>{guest.name}</div>
            <div style={{ fontSize: 13, color: '#8892a4' }}>Room {guest.room} • {guest.status}</div>
          </div>
          <div style={{
            background: '#f5a62320',
            border: '1px solid #f5a623',
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: 11,
            color: '#f5a623',
          }}>
            ${guest.totalSpent} total spent
          </div>
        </div>

        <div className="guest-grid">
          <div>
            <div style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: '#f5a623', marginBottom: 8 }}>STAY DETAILS</div>
            <div style={{ fontSize: 12, color: '#8892a4' }}>Check-in: {guest.checkIn}</div>
            <div style={{ fontSize: 12, color: '#8892a4' }}>Check-out: {guest.checkOut}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: '#f5a623', marginBottom: 8 }}>PREFERENCES</div>
            {guest.preferences.map((pref, i) => (
              <div key={i} style={{ fontSize: 12, color: '#8892a4' }}>• {pref}</div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: '#f5a623', marginBottom: 8 }}>REQUEST HISTORY</div>
          {guest.requests.map((req, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              <span style={{ fontSize: 12, color: '#e8eaf0' }}>{req.message}</span>
              <span style={{ fontSize: 10, color: req.resolved ? '#4ade80' : '#f87171' }}>
                {req.resolved ? 'Resolved' : 'Pending'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}