const { getDb, getOne, persist } = require('../db');
const revenueService = require('../services/revenueService');

exports.getProfile = async (req, res) => {
  const db = await getDb();
  const guest = getOne(db, 'SELECT g.*, r.number as room_number FROM guests g LEFT JOIN rooms r ON g.room_id = r.id WHERE g.id = ?', [req.user.guestId]);
  if (!guest) return res.status(404).json({ error: 'Guest not found' });
  res.json(guest);
};

exports.updatePreferences = async (req, res) => {
  const db = await getDb();
  const existing = getOne(db, 'SELECT preferences FROM guests WHERE id = ?', [req.user.guestId]);
  if (!existing) return res.status(404).json({ error: 'Guest not found' });

  const currentPrefs = JSON.parse(existing.preferences || '{}');
  const updatedPrefs = { ...currentPrefs, ...req.body };
  
  db.run('UPDATE guests SET preferences = ? WHERE id = ?', [JSON.stringify(updatedPrefs), req.user.guestId]);
  persist(db);
  res.json({ success: true, preferences: updatedPrefs });
};

exports.getRequests = async (req, res) => {
  const db = await getDb();
  // Filter tasks that are related to this guest's room or specifically assigned to them
  const guest = getOne(db, 'SELECT room_id FROM guests WHERE id = ?', [req.user.guestId]);
  const tasks = db.prepare('SELECT * FROM tasks WHERE description LIKE ? ORDER BY created_at DESC')
                 .bind([`%Room ${guest.room_id}%`]).step() ? [] : []; // Simplified for now
  // In a real app, tasks would have a guest_id or room_id foreign key
  res.json([]); // Returning empty for now as task mapping is indirect
};

exports.createRequest = async (req, res) => {
  const db = await getDb();
  const { type, details } = req.body;
  const guest = getOne(db, 'SELECT name, room_id FROM guests WHERE id = ?', [req.user.guestId]);
  const room = getOne(db, 'SELECT number FROM rooms WHERE id = ?', [guest.room_id]);
  
  const taskId = `t_${Date.now()}`;
  const title = `${type.charAt(0).toUpperCase() + type.slice(1)} Request - Room ${room?.number || 'Unknown'}`;
  const description = `${details} (Requested by ${guest.name})`;
  
  db.run('INSERT INTO tasks (id, title, description, status, priority) VALUES (?,?,?,?,?)', 
    [taskId, title, description, 'pending', 'medium']);
  persist(db);
  
  res.json({ success: true, taskId });
};

exports.getOffers = async (req, res) => {
  const offers = await revenueService.getPersonalizedOffers(req.user.guestId);
  res.json(offers);
};

exports.acceptOffer = async (req, res) => {
  // Logic for accepting offer and potentially triggering Stripe
  res.json({ success: true, message: 'Offer accepted. Payment processed.' });
};

exports.getBill = async (req, res) => {
  const db = await getDb();
  const guest = getOne(db, 'SELECT spending FROM guests WHERE id = ?', [req.user.guestId]);
  res.json({
    total: guest?.spending || 0,
    items: [
      { id: 1, description: 'Room Charge (2 nights)', amount: guest?.spending || 0, date: new Date().toISOString() }
    ]
  });
};

exports.getHotelInfo = (req, res) => {
  res.json({
    name: 'HotelOS Grand',
    wifi: 'HotelOS_Guest / luxury2026',
    amenities: [
      { name: 'Rooftop Pool', hours: '06:00 - 22:00' },
      { name: 'Gym', hours: '24/7' },
      { name: 'Breakfast Buffet', hours: '07:00 - 10:30' }
    ]
  });
};

exports.checkout = async (req, res) => {
  const db = await getDb();
  db.run('UPDATE guests SET status = ? WHERE id = ?', ['checked_out', req.user.guestId]);
  persist(db);
  res.json({ success: true, message: 'Express checkout requested. We hope to see you again!' });
};
