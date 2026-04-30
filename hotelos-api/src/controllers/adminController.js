const { getDb, all, getOne } = require('../db');
const reviewService = require('../services/reviewService');

exports.getMetrics = async (req, res) => {
  const db = await getDb();
  const rooms = all(db, 'SELECT * FROM rooms');
  const guests = all(db, 'SELECT spending FROM guests WHERE status = "checked_in"');
  
  const occupied = rooms.filter(r => r.status === 'occupied').length;
  const totalRevenue = guests.reduce((sum, g) => sum + (g.spending || 0), 0);
  const adr = occupied > 0 ? (totalRevenue / occupied).toFixed(2) : 0;
  
  res.json({
    revenue: totalRevenue,
    occupancyRate: +(occupied / rooms.length).toFixed(2),
    adr: +adr,
    revPar: +(totalRevenue / rooms.length).toFixed(2)
  });
};

exports.getReviews = async (req, res) => {
  const reviews = await reviewService.getReviews(req.query);
  res.json(reviews);
};

exports.respondToReview = async (req, res) => {
  await reviewService.respondToReview(req.params.id, req.body.response);
  res.json({ success: true });
};

exports.getDepartments = async (req, res) => {
  const db = await getDb();
  const tasks = all(db, 'SELECT status FROM tasks');
  
  const stats = {
    Housekeeping: { completed: 12, pending: 2, avgResponse: '14m' },
    Maintenance: { completed: 5, pending: 1, avgResponse: '28m' },
    FrontDesk: { completed: 45, pending: 0, avgResponse: '3m' }
  };
  
  res.json(stats);
};

exports.getSystemUsage = async (req, res) => {
  res.json({
    activeGuests: 8,
    staffOnline: 4,
    agentDecisionsToday: 156,
    wsConnections: 12
  });
};

exports.getRevenueBreakdown = async (req, res) => {
  res.json([
    { source: 'Room Charges', amount: 12500 },
    { source: 'Upgrades', amount: 1200 },
    { source: 'Spa', amount: 800 },
    { source: 'F&B', amount: 2300 }
  ]);
};

exports.getResolvedIssues = async (req, res) => {
  res.json([
    { type: 'Maintenance', count: 42, avgTime: '35m' },
    { type: 'Guest Request', count: 128, avgTime: '8m' },
    { type: 'System Alert', count: 15, avgTime: '2m' }
  ]);
};
