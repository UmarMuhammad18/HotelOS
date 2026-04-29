import { useState, useEffect } from 'react';

export default function IssuesResolved() {
  const [issues, setIssues] = useState([]);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL || ''}/api/admin/issues/resolved`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('hotelos_token')}` }
    })
    .then(res => res.json())
    .then(setIssues);
  }, []);

  return (
    <div>
      <style>{`
        .issues-table { width: 100%; border-collapse: collapse; margin-top: 24px; background: #0e1117; border-radius: 16px; overflow: hidden; }
        .issues-table th { text-align: left; padding: 16px; background: rgba(255,255,255,0.03); color: #8892a4; }
        .issues-table td { padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
      `}</style>
      <h1>Issues Resolved</h1>
      <table className="issues-table">
        <thead>
          <tr><th>Issue Type</th><th>Count (Today)</th><th>Avg Resolution Time</th></tr>
        </thead>
        <tbody>
          {issues.map((i, idx) => (
            <tr key={idx}><td>{i.type}</td><td>{i.count}</td><td>{i.avgTime}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
