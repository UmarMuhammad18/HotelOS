import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { API_BASE } from '../../config';

export default function GuestBill() {
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/guest/bill`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('hotelos_token')}` }
    })
    .then(res => res.json())
    .then(data => {
      setBill(data);
      setLoading(false);
    });
  }, []);

  const handleCheckout = async () => {
    if (!window.confirm('Are you sure you want to request express checkout?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/guest/checkout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('hotelos_token')}` }
      });
      if (res.ok) {
        toast.success('Express checkout requested! Safe travels.');
      }
    } catch (err) {
      toast.error('Failed to request checkout');
    }
  };

  return (
    <div className="guest-bill">
      <style>{`
        h2 { margin-bottom: 24px; }
        .bill-card {
          background: #0e1117;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 24px;
        }
        .bill-item {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          font-size: 14px;
        }
        .bill-total {
          display: flex;
          justify-content: space-between;
          padding: 24px 0 12px;
          font-size: 20px;
          font-weight: 700;
          color: #f5a623;
        }
        .checkout-btn {
          width: 100%;
          background: #f87171;
          color: #fff;
          border: none;
          padding: 14px;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
          margin-top: 24px;
        }
      `}</style>

      <h2>Current Bill</h2>

      {loading ? <p>Loading bill...</p> : (
        <motion.div 
          className="bill-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="bill-items">
            {bill.items.map((item, i) => (
              <div className="bill-item" key={i}>
                <div>
                  <div style={{ fontWeight: 600 }}>{item.description}</div>
                  <div style={{ fontSize: 11, color: '#8892a4' }}>{new Date(item.date).toLocaleDateString()}</div>
                </div>
                <div>${item.amount.toFixed(2)}</div>
              </div>
            ))}
          </div>

          <div className="bill-total">
            <span>Total Balance</span>
            <span>${bill.total.toFixed(2)}</span>
          </div>

          <p style={{ fontSize: 12, color: '#8892a4', marginTop: 16 }}>
            * Final bill will be sent to your email upon checkout.
          </p>

          <button className="checkout-btn" onClick={handleCheckout}>
            Request Express Checkout
          </button>
        </motion.div>
      )}
    </div>
  );
}
