const { getDb, all, getOne } = require('../db');

async function getPersonalizedOffers(guestId) {
  const db = await getDb();
  const guest = getOne(db, 'SELECT * FROM guests WHERE id = ?', [guestId]);
  if (!guest) return [];

  // Mocked personalized offers based on guest status/loyalty
  const offers = [
    {
      id: 'off_1',
      title: 'Room Upgrade: Executive Suite',
      description: 'Enjoy more space and premium amenities with a discounted upgrade.',
      price: 4500, // in cents
      currency: 'usd',
      image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'off_2',
      title: 'Spa & Wellness Package',
      description: '60-minute full body massage + access to thermal suite.',
      price: 8500,
      currency: 'usd',
      image: 'https://images.unsplash.com/photo-1544161515-4ae6ce6ca8b8?auto=format&fit=crop&w=400&q=80'
    }
  ];

  if (guest.loyalty_tier === 'platinum' || guest.loyalty_tier === 'gold') {
    offers.push({
      id: 'off_3',
      title: 'Late Checkout (3 PM)',
      description: 'Complimentary late checkout for our valued members.',
      price: 0,
      currency: 'usd',
      image: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=400&q=80'
    });
  } else {
    offers.push({
      id: 'off_3',
      title: 'Late Checkout (2 PM)',
      description: 'Extend your stay for a small fee.',
      price: 2500,
      currency: 'usd',
      image: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=400&q=80'
    });
  }

  return offers;
}

module.exports = {
  getPersonalizedOffers
};
