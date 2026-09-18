import { useEffect, useState } from 'react';
import { API_BASE } from '../../config';

export default function MetricsDigest() {
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [digest, setDigest] = useState('');
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('hotelos_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const candidates = [
        `${API_BASE}/api/metrics/digest?days=${days}`,
        `${API_BASE}/v1/metrics/digest?days=${days}`,
        `${API_BASE}/api/admin/metrics/digest?days=${days}`,
      ];
      let ok = false;
      for (const url of candidates) {
        try {
          const res = await fetch(url, { headers });
          if (!res.ok) continue;
          const data = await res.json();
          if (cancelled) return;
          setDigest(data.digest || data.summary || JSON.stringify(data, null, 2));
          setMetrics(data.metrics || data);
          ok = true;
          break;
        } catch {
          /* try next */
        }
      }
      if (!ok && !cancelled) {
        setError('Metrics API not reachable yet — showing placeholder KPIs.');
        setMetrics({
          events_processed: '—',
          median_resolution_minutes: '—',
          emergencies: '—',
          repeat_issues_caught: '—',
          staff_hours_saved_est: '—',
        });
        setDigest(
          'Connect the AI advisor metrics endpoint (`/v1/metrics/digest`) through the backend proxy to populate this digest automatically.'
        );
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [days]);

  const cards = [
    { label: 'Events processed', key: 'events_processed' },
    { label: 'Median resolution (min)', key: 'median_resolution_minutes' },
    { label: 'Emergencies', key: 'emergencies' },
    { label: 'Repeat issues caught', key: 'repeat_issues_caught' },
    { label: 'Staff hours saved (est.)', key: 'staff_hours_saved_est' },
  ];

  const valueFor = (key) => {
    if (!metrics) return '—';
    if (metrics[key] != null) return metrics[key];
    if (metrics.totals && metrics.totals[key] != null) return metrics.totals[key];
    return '—';
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Metrics digest</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--ho-text-muted)', fontSize: 14 }}>
            Weekly GM view — resolution speed, emergencies, and AI impact.
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          style={{
            background: 'var(--ho-bg-card)',
            color: 'var(--ho-text)',
            border: '1px solid var(--ho-border)',
            borderRadius: 8,
            padding: '8px 12px',
          }}
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      {error && (
        <div className="ho-card" style={{ marginBottom: 16, borderColor: 'rgba(234,179,8,0.3)', color: 'var(--ho-warning)' }}>
          {error}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {cards.map((c) => (
          <div key={c.key} className="ho-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--ho-text-muted)', fontFamily: 'var(--ho-mono)', marginBottom: 8 }}>
              {c.label.toUpperCase()}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ho-accent)' }}>
              {loading ? '…' : valueFor(c.key)}
            </div>
          </div>
        ))}
      </div>

      <div className="ho-card">
        <div style={{ fontSize: 12, color: 'var(--ho-text-muted)', marginBottom: 12, fontFamily: 'var(--ho-mono)' }}>
          DIGEST
        </div>
        <pre
          style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            fontFamily: 'var(--ho-mono)',
            fontSize: 13,
            lineHeight: 1.55,
            color: 'var(--ho-text)',
          }}
        >
          {loading ? 'Loading…' : digest}
        </pre>
        {!loading && digest && (
          <button
            className="ho-btn-ghost"
            style={{ marginTop: 16 }}
            onClick={() =>
              navigator.clipboard?.writeText(
                typeof digest === 'string' ? digest : JSON.stringify(digest, null, 2)
              )
            }
          >
            Copy digest
          </button>
        )}
      </div>
    </div>
  );
}
