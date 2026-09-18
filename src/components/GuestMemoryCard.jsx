import { useEffect, useState } from 'react';
import { API_BASE } from '../config';

/**
 * "We remembered" surface — pulls memory/diff when guestId is known.
 */
export default function GuestMemoryCard({ guestId, fallbackPrefs }) {
  const [learned, setLearned] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!guestId) return;
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem('hotelos_token');
        const res = await fetch(`${API_BASE}/api/guests/${guestId}/memory/diff`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('unavailable');
        const data = await res.json();
        if (!cancelled) setLearned(data.learned || data.diff || data || {});
      } catch {
        if (!cancelled) setError('offline');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [guestId]);

  const entries =
    learned && typeof learned === 'object'
      ? Object.entries(learned).filter(([, v]) => v)
      : fallbackPrefs
        ? Object.entries(fallbackPrefs).filter(([, v]) => v)
        : [];

  if (!entries.length && error) {
    return (
      <div className="ho-card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--ho-text-muted)', marginBottom: 8 }}>GUEST MEMORY</div>
        <p style={{ margin: 0, color: 'var(--ho-text-muted)', fontSize: 14 }}>
          Preferences will appear here as we learn your stay patterns.
        </p>
      </div>
    );
  }

  if (!entries.length) return null;

  return (
    <div className="ho-card" style={{ marginBottom: 20, borderColor: 'rgba(245,166,35,0.25)' }}>
      <div style={{ fontSize: 12, color: 'var(--ho-accent)', marginBottom: 10, fontFamily: 'var(--ho-mono)' }}>
        WE REMEMBERED
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ho-text)', fontSize: 14, lineHeight: 1.6 }}>
        {entries.slice(0, 6).map(([k, v]) => (
          <li key={k}>
            <strong style={{ textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</strong>
            {v !== true ? `: ${v}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
