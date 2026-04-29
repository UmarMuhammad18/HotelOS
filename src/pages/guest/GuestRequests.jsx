import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { API_BASE } from '../../config';

export default function GuestRequests() {
  const [loading, setLoading] = useState(false);
  const [requestType, setRequestType] = useState('housekeeping');
  const [details, setDetails] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/guest/requests`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hotelos_token')}` 
        },
        body: JSON.stringify({ type: requestType, details })
      });
      if (res.ok) {
        toast.success('Request submitted successfully!');
        setDetails('');
      } else {
        toast.error('Failed to submit request');
      }
    } catch (err) {
      toast.error('Connection error');
    }
    setLoading(false);
  };

  return (
    <div className="guest-requests">
      <style>{`
        h2 { margin-bottom: 24px; }
        .request-form {
          background: #0e1117;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 24px;
        }
        .form-group { margin-bottom: 20px; }
        label { display: block; font-size: 13px; color: #8892a4; margin-bottom: 8px; }
        select, textarea {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 12px;
          color: #fff;
          font-family: inherit;
        }
        textarea { height: 120px; resize: none; }
        .submit-btn {
          width: 100%;
          background: #f5a623;
          color: #090b0f;
          border: none;
          padding: 14px;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
        }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <h2>New Request</h2>

      <motion.form 
        className="request-form"
        onSubmit={handleSubmit}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="form-group">
          <label>Request Type</label>
          <select value={requestType} onChange={(e) => setRequestType(e.target.value)}>
            <option value="housekeeping">Housekeeping (Towels, Cleaning)</option>
            <option value="maintenance">Maintenance (Repair, AC)</option>
            <option value="front desk">Front Desk (Taxi, Wake up)</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="form-group">
          <label>Specific Details</label>
          <textarea 
            placeholder="Please let us know exactly what you need..."
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Submitting...' : 'Send Request'}
        </button>
      </motion.form>
    </div>
  );
}
