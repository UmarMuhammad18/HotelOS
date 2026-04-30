import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { API_BASE } from '../../config';

export default function ReviewsManager() {
  const [reviews, setReviews] = useState([]);
  const [respondingTo, setRespondingTo] = useState(null);
  const [response, setResponse] = useState('');

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = () => {
    fetch(`${API_BASE}/api/admin/reviews`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('hotelos_token')}` }
    })
    .then(res => res.json())
    .then(setReviews);
  };

  const handleRespond = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/admin/reviews/${respondingTo}/respond`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hotelos_token')}` 
        },
        body: JSON.stringify({ response })
      });
      if (res.ok) {
        toast.success('Response sent!');
        setRespondingTo(null);
        setResponse('');
        fetchReviews();
      }
    } catch (err) {
      toast.error('Failed to send response');
    }
  };

  return (
    <div className="reviews-manager">
      <style>{`
        .reviews-table { width: 100%; border-collapse: collapse; margin-top: 24px; }
        .reviews-table th { text-align: left; padding: 12px; border-bottom: 2px solid rgba(255,255,255,0.07); color: #8892a4; font-size: 13px; }
        .reviews-table td { padding: 16px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .stars { color: #f5a623; }
        .respond-btn { background: #f5a623; color: #090b0f; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; }
        
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal { background: #0e1117; padding: 32px; border-radius: 16px; width: 500px; border: 1px solid #f5a623; }
        textarea { width: 100%; height: 120px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 12px; margin: 16px 0; border-radius: 8px; font-family: inherit; }
      `}</style>

      <h1>Guest Reviews</h1>

      <table className="reviews-table">
        <thead>
          <tr>
            <th>Guest</th>
            <th>Rating</th>
            <th>Comment</th>
            <th>Response</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {reviews.map((r) => (
            <tr key={r.id}>
              <td>{r.guest_name} <br/><small style={{color: '#8892a4'}}>Room {r.room_number}</small></td>
              <td className="stars">{'★'.repeat(r.rating)}</td>
              <td style={{ maxWidth: 300 }}>{r.comment}</td>
              <td style={{ fontStyle: 'italic', color: '#8892a4' }}>{r.response || 'No response yet'}</td>
              <td>
                {!r.response && (
                  <button className="respond-btn" onClick={() => setRespondingTo(r.id)}>Respond</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {respondingTo && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Respond to Review</h3>
            <form onSubmit={handleRespond}>
              <textarea 
                placeholder="Write your response as General Manager..."
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                required
              />
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="submit" className="respond-btn" style={{ flex: 1 }}>Send Response</button>
                <button type="button" onClick={() => setRespondingTo(null)} style={{ flex: 1, background: '#4e5a6e', color: '#fff', border: 'none', borderRadius: 4 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
