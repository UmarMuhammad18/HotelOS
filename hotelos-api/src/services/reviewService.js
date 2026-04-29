const { getDb, all, getOne, persist } = require('../db');

async function getReviews(filters = {}) {
  const db = await getDb();
  let sql = `
    SELECT r.*, g.name as guest_name, g.room_id 
    FROM reviews r 
    JOIN guests g ON r.guest_id = g.id
  `;
  const params = [];
  
  if (filters.rating) {
    sql += ` WHERE r.rating = ?`;
    params.push(filters.rating);
  }
  
  sql += ` ORDER BY r.created_at DESC`;
  
  return all(db, sql, params);
}

async function respondToReview(reviewId, response) {
  const db = await getDb();
  db.run('UPDATE reviews SET response = ? WHERE id = ?', [response, reviewId]);
  persist(db);
  return true;
}

async function createReview(guestId, rating, comment) {
  const db = await getDb();
  const id = `rev_${Date.now()}`;
  db.run('INSERT INTO reviews (id, guest_id, rating, comment) VALUES (?,?,?,?)', [id, guestId, rating, comment]);
  persist(db);
  return { id, guestId, rating, comment };
}

module.exports = {
  getReviews,
  respondToReview,
  createReview
};
