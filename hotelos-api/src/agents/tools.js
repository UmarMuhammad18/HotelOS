const { persist, all, getOne } = require('../db');
const { storePreference, retrieveSimilarPreferences } = require('./memory');

let dbInstance = null;
let broadcastCallback = null;

function initTools(db, broadcast) {
  dbInstance = db;
  broadcastCallback = broadcast;
}

function broadcast(agent, type, message, details = '') {
  if (broadcastCallback) {
    broadcastCallback({
      type,
      agent,
      message,
      details,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * modify room rates in the in‑memory state and database
 */
async function adjustPricing({ roomType, percentage, reason }) {
  if (!dbInstance) return "Error: DB not initialized";
  const p = Number(percentage);
  if (isNaN(p)) return "Error: Invalid percentage";
  
  const multiplier = 1 + (p / 100);
  // Get rooms of type
  const rooms = all(dbInstance, 'SELECT * FROM rooms WHERE type = ?', [roomType]);
  if (rooms.length === 0) return `No rooms found for type: ${roomType}`;

  // Update rates
  for (const r of rooms) {
    const newRate = r.rate * multiplier;
    dbInstance.run('UPDATE rooms SET rate = ? WHERE id = ?', [newRate, r.id]);
  }
  persist(dbInstance);

  const msg = `Adjusted ${roomType} pricing by ${p}% (${reason})`;
  broadcast('Revenue AI', 'execution', msg, `Updated ${rooms.length} rooms`);
  return msg;
}

/**
 * Queue an offer to the guest
 */
async function sendUpgradeOffer({ guestId, roomNumber, offerPrice }) {
  const msg = `Upgrade offer sent to guest ${guestId} for room ${roomNumber} at $${offerPrice}.`;
  broadcast('Concierge AI', 'execution', msg, 'Awaiting guest response.');
  return msg;
}

/**
 * Insert a new task into the tasks table
 */
async function assignTask({ taskType, roomNumber, priority }) {
  if (!dbInstance) return "Error: DB not initialized";
  const id = `t${Date.now()}`;
  const title = `${taskType} - Room ${roomNumber}`;
  
  dbInstance.run(
    `INSERT INTO tasks (id, title, description, status, priority, assigned_to) VALUES (?,?,?,?,?,?)`,
    [id, title, 'Auto-assigned by AI', 'pending', priority, null]
  );
  persist(dbInstance);

  const msg = `Assigned new task: ${title} (Priority: ${priority})`;
  broadcast('Operations AI', 'execution', msg, '');
  return msg;
}

/**
 * Update task status
 */
async function updateTaskStatus({ taskId, newStatus }) {
  if (!dbInstance) return "Error: DB not initialized";
  const task = getOne(dbInstance, 'SELECT * FROM tasks WHERE id = ?', [taskId]);
  if (!task) return `Error: Task ${taskId} not found.`;

  dbInstance.run('UPDATE tasks SET status = ? WHERE id = ?', [newStatus, taskId]);
  persist(dbInstance);

  const msg = `Task ${task.title} status updated to ${newStatus}.`;
  broadcast('Operations AI', 'execution', msg, '');
  return msg;
}

/**
 * Send a message to the guest
 */
async function sendMessage({ guestId, message }) {
  const msg = `Sent message to guest ${guestId}: "${message}"`;
  broadcast('Guest Experience', 'execution', msg, '');
  return msg;
}

/**
 * Retrieve preferences from memory store
 */
async function getGuestPreferences({ guestId }) {
  const prefs = retrieveSimilarPreferences(guestId, '', 5);
  return prefs.length > 0 ? prefs.join('; ') : "No known preferences.";
}

/**
 * Store or update guest preferences
 */
async function updatePreferences({ guestId, preferences }) {
  storePreference(guestId, preferences);
  const msg = `Updated preferences for guest ${guestId}.`;
  broadcast('Guest Experience', 'execution', msg, preferences);
  return msg;
}

/**
 * Return mock demand forecast
 */
async function forecastDemand({ dateRange }) {
  // Mock forecast based on historical occupancy logic
  const forecast = Math.floor(Math.random() * 30) + 70; // 70-99%
  return `Forecasted occupancy for ${dateRange} is ${forecast}%`;
}

/**
 * Create a ticket and broadcast alert
 */
async function createMaintenanceTicket({ roomNumber, issueDescription }) {
  if (!dbInstance) return "Error: DB not initialized";
  const id = `t${Date.now()}`;
  const title = `Maintenance Room ${roomNumber} - ${issueDescription}`;
  
  dbInstance.run(
    `INSERT INTO tasks (id, title, description, status, priority, assigned_to) VALUES (?,?,?,?,?,?)`,
    [id, title, 'Auto-assigned by Maintenance AI', 'pending', 'high', 'Engineering Pool']
  );
  persist(dbInstance);

  const msg = `Created maintenance ticket: ${title}`;
  broadcast('Maintenance AI', 'alert', msg, 'Technician dispatched');
  return `Ticket ${id} created.`;
}

/**
 * Return mock ETA
 */
async function getTechnicianETA({ ticketId }) {
  const times = ['10 minutes', '15 minutes', '30 minutes'];
  return times[Math.floor(Math.random() * times.length)];
}

module.exports = {
  initTools,
  adjustPricing,
  sendUpgradeOffer,
  assignTask,
  updateTaskStatus,
  sendMessage,
  getGuestPreferences,
  updatePreferences,
  forecastDemand,
  createMaintenanceTicket,
  getTechnicianETA
};
