import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { API_BASE } from '../../config';

export default function GuestOffers() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/guest/offers`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('hotelos_token')}` }
    })
    .then(res => res.json())
    .then(data => {
      setOffers(data);
      setLoading(false);
    });
  }, []);

  const handleAccept = async (offerId) => {
    try {
      const res = await fetch(`${API_BASE}/api/guest/offers/${offerId}/accept`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('hotelos_token')}` }
      });
      if (res.ok) {
        toast.success('Offer accepted! Enjoy your upgrade.');
      }
    } catch (err) {
      toast.error('Failed to process offer');
    }
  };

  return (
    <div className="guest-offers">
      <style>{`
        h2 { margin-bottom: 24px; }
        .offer-grid { display: flex; flex-direction: column; gap: 20px; }
        .offer-card {
          background: #0e1117;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          overflow: hidden;
        }
        .offer-img { width: 100%; height: 160px; object-fit: cover; }
        .offer-body { padding: 20px; }
        .offer-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
        .offer-desc { font-size: 14px; color: #8892a4; margin-bottom: 16px; }
        .offer-footer { display: flex; justify-content: space-between; align-items: center; }
        .offer-price { font-weight: 700; color: #f5a623; }
        .accept-btn {
          background: #f5a623;
          color: #090b0f;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
        }
      `}</style>

      <h2>Personalized Offers</h2>

      {loading ? <p>Loading offers...</p> : (
        <div className="offer-grid">
          {offers.map((offer) => (
            <motion.div 
              key={offer.id}
              className="offer-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <img src={offer.image} alt={offer.title} className="offer-img" />
              <div className="offer-body">
                <div className="offer-title">{offer.title}</div>
                <div className="offer-desc">{offer.description}</div>
                <div className="offer-footer">
                  <div className="offer-price">
                    {offer.price === 0 ? 'FREE' : `$${(offer.price / 100).toFixed(2)}`}
                  </div>
                  <button className="accept-btn" onClick={() => handleAccept(offer.id)}>
                    Accept Offer
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
