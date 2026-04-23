let simRunning = false;
let simSpeed = 1;
let simTimer = null;

let broadcastCallback = null;
let getDbCallback = null;
let orchestratorCallback = null;

function initSimulation(options) {
  broadcastCallback = options.broadcastAgentEvent;
  getDbCallback = options.getDb;
  orchestratorCallback = options.orchestratorProcessEvent;
}

const EVENT_SCENARIOS = {
  late_arrival: { type: 'late_arrival', message: 'Late guest arrival for room 104' },
  room_issue: { type: 'room_issue', message: 'AC failure reported in Room 206' },
  vip_guest: { type: 'vip_guest', message: 'VIP check-in expected in 1 hour' },
  staff_shortage: { type: 'staff_shortage', message: 'Staff shortage — only 2 housekeepers available' },
  overbooking: { type: 'overbooking', message: 'Overbooking detected — 2 rooms over capacity' },
  early_checkout: { type: 'early_checkout', message: 'Early checkout request from Room 302' },
};

function startSimulation(speed) {
  if (simTimer) clearInterval(simTimer);
  simRunning = true;
  simSpeed = Math.min(5, Math.max(0.5, Number(speed) || simSpeed));
  const delay = Math.round(5000 / simSpeed); // Less frequent than old sim to allow agent processing

  simTimer = setInterval(async () => {
    // Generate a random event from the scenarios and pass it to the orchestrator
    const keys = Object.keys(EVENT_SCENARIOS);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    const event = EVENT_SCENARIOS[randomKey];
    
    if (orchestratorCallback) {
       orchestratorCallback(event);
    }
    
    maybeRandomRoomEvent();
  }, delay);
}

function stopSimulation() {
  simRunning = false;
  if (simTimer) {
    clearInterval(simTimer);
    simTimer = null;
  }
}

async function maybeRandomRoomEvent() {
  if (Math.random() > 0.5) return;
  
  const db = await getDbCallback();
  const roomsRow = db.exec('SELECT * FROM rooms LIMIT 20');
  if (!roomsRow || !roomsRow[0] || !roomsRow[0].values) return;
  
  const rooms = roomsRow[0].values;
  if (!rooms.length) return;
  
  const randomRow = rooms[Math.floor(Math.random() * rooms.length)];
  const roomId = randomRow[0];
  const roomNumber = randomRow[1];
  
  const statuses = ['occupied', 'cleaning', 'maintenance', 'available', 'checkout'];
  const next = statuses[Math.floor(Math.random() * statuses.length)];
  const map = { available: 'vacant', occupied: 'occupied', cleaning: 'cleaning', maintenance: 'maintenance', checkout: 'checkout' };
  const webStatus = map[next] || next;
  const dbStatus = webStatus === 'vacant' ? 'available' : webStatus;
  
  db.run('UPDATE rooms SET status = ? WHERE id = ?', [dbStatus, roomId]);
  
  if (broadcastCallback) {
    broadcastCallback({
      type: 'status_change',
      room: roomNumber,
      status: webStatus,
      timestamp: new Date().toISOString(),
    });
  }

  // Trigger orchestrator on status change
  if (orchestratorCallback) {
    orchestratorCallback({ type: 'status_change', room: roomNumber, status: webStatus });
  }
}

function getSimRunning() {
  return simRunning;
}

function getSimSpeed() {
  return simSpeed;
}

function injectEvent(eventType) {
  const event = EVENT_SCENARIOS[eventType];
  if (event && orchestratorCallback) {
    orchestratorCallback(event);
    return event;
  }
  return null;
}

module.exports = {
  initSimulation,
  startSimulation,
  stopSimulation,
  getSimRunning,
  getSimSpeed,
  injectEvent,
  EVENT_SCENARIOS
};
