/**
 * SQLite persistence via sql.js (WASM) — no native Prisma/query engine binaries.
 */
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_PATH = process.env.DATABASE_FILE || path.join(__dirname, '..', 'dev.db');

let dbPromise;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password_hash TEXT,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'staff', -- 'guest', 'staff', 'admin'
  guest_id TEXT, -- Link to guests table if role is 'guest'
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (guest_id) REFERENCES guests(id)
);
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL,
  floor INTEGER NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  rate REAL DEFAULT 0,
  temperature REAL,
  do_not_disturb INTEGER DEFAULT 0,
  last_cleaned TEXT,
  amenities TEXT DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  last_name TEXT,
  booking_confirmation TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL,
  room_id TEXT,
  loyalty_tier TEXT,
  is_vip INTEGER DEFAULT 0,
  spending REAL DEFAULT 0,
  check_in TEXT,
  check_out TEXT,
  preferences TEXT DEFAULT '{}',
  special_requests TEXT DEFAULT '[]',
  purchase_history TEXT DEFAULT '[]',
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  assigned_to TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  read INTEGER DEFAULT 0,
  timestamp TEXT DEFAULT (datetime('now')),
  user_id TEXT
);
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT,
  response TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (guest_id) REFERENCES guests(id)
);
CREATE TABLE IF NOT EXISTS payment_transactions (
  id TEXT PRIMARY KEY,
  stripe_payment_intent_id TEXT UNIQUE NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL,
  product_type TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);
`;

function persist(db) {
  const data = db.export();
  const buf = Buffer.from(data);
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, buf);
}

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const SQL = await initSqlJs();
      let db;
      if (fs.existsSync(DB_PATH)) {
        const filebuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(filebuffer);
      } else {
        db = new SQL.Database();
      }
      db.exec(SCHEMA);
      
      // Migration: staff_users -> users
      try {
        const check = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='staff_users'");
        if (check.length > 0) {
          console.log('Migrating staff_users to users...');
          db.exec(`INSERT INTO users (id, email, password_hash, name, role, created_at) 
                   SELECT id, email, password_hash, name, role, created_at FROM staff_users`);
          db.exec("DROP TABLE staff_users");
        }
      } catch (err) {
        console.error('Migration error:', err);
      }

      const cntRes = db.exec('SELECT COUNT(*) FROM rooms');
      const roomCount = cntRes[0]?.values?.[0]?.[0] ?? 0;
      if (roomCount === 0) {
        await seedFromJson(db);
        persist(db);
      }
      return db;
    })();
  }
  return dbPromise;
}

async function seedFromJson(db) {
  const seedDir = process.env.DATABASE_SEED_DIR || path.join(__dirname, '..', 'Database');
  const roomsRaw = JSON.parse(fs.readFileSync(path.join(seedDir, 'rooms.json'), 'utf8'));
  const guestsRaw = JSON.parse(fs.readFileSync(path.join(seedDir, 'guests.json'), 'utf8'));
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('staff123', 10);
  const adminHash = await bcrypt.hash('admin123', 10);

  const insRoom = db.prepare(
    `INSERT INTO rooms (id, number, floor, type, status, rate, temperature, do_not_disturb, last_cleaned, amenities)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  );
  for (const r of roomsRaw) {
    insRoom.run([
      r.id,
      String(r.number),
      r.floor,
      r.type,
      r.status,
      r.rate ?? 0,
      r.temperature ?? null,
      r.do_not_disturb ? 1 : 0,
      r.last_cleaned ?? null,
      JSON.stringify(r.amenities ?? []),
    ]);
  }
  insRoom.free();

  const insG = db.prepare(
    `INSERT INTO guests (id, name, last_name, booking_confirmation, email, phone, status, room_id, loyalty_tier, is_vip, spending, check_in, check_out, preferences, special_requests, purchase_history)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, '[]')`
  );
  for (const g of guestsRaw) {
    const names = g.name.split(' ');
    const lastName = names[names.length - 1];
    const bookingRef = `BK-${Math.floor(1000 + Math.random() * 9000)}`;
    
    insG.run([
      g.id,
      g.name,
      lastName,
      bookingRef,
      g.email ?? null,
      g.phone ?? null,
      g.status,
      g.room_id ?? null,
      g.loyalty_tier ?? null,
      g.is_vip ? 1 : 0,
      g.spending ?? 0,
      g.check_in ?? null,
      g.check_out ?? null,
      JSON.stringify(g.preferences ?? {}),
      JSON.stringify(g.special_requests ?? []),
    ]);
  }
  insG.free();

  // Create Staff
  db.run(`INSERT INTO users (id, email, password_hash, name, role) VALUES (?,?,?,?,?)`, [
    'staff_demo',
    'demo@hotelos.app',
    hash,
    'Demo Staff',
    'staff',
  ]);

  // Create Admin
  db.run(`INSERT INTO users (id, email, password_hash, name, role) VALUES (?,?,?,?,?)`, [
    'admin_demo',
    'admin@hotelos.app',
    adminHash,
    'General Manager',
    'admin',
  ]);

  db.run(
    `INSERT INTO tasks (id, title, description, status, priority, assigned_to) VALUES (?,?,?,?,?,?)`,
    [`t${Date.now()}`, 'Housekeeping room 104', 'Turndown service', 'pending', 'high', null]
  );

  // Seed some reviews
  const reviewData = [
    { id: 'rev1', guest_id: 'g001', rating: 5, comment: 'Amazing service and smooth AI coordination!' },
    { id: 'rev2', guest_id: 'g002', rating: 4, comment: 'Very comfortable stay, liked the digital twin map.' },
    { id: 'rev3', guest_id: 'g003', rating: 5, comment: 'The best hotel experience I have had in years.' }
  ];
  const insRev = db.prepare(`INSERT INTO reviews (id, guest_id, rating, comment) VALUES (?,?,?,?)`);
  for (const r of reviewData) insRev.run([r.id, r.guest_id, r.rating, r.comment]);
  insRev.free();
}

function rowRoom(r) {
  if (!r) return null;
  return {
    id: r.id,
    number: r.number,
    floor: r.floor,
    type: r.type,
    status: r.status,
    rate: r.rate,
    temperature: r.temperature,
    doNotDisturb: !!r.do_not_disturb,
    lastCleaned: r.last_cleaned,
    amenities: r.amenities,
  };
}

function all(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const out = [];
  while (stmt.step()) out.push(stmt.getAsObject());
  stmt.free();
  return out;
}

function getOne(db, sql, params = []) {
  const rows = all(db, sql, params);
  return rows[0] || null;
}

module.exports = {
  getDb,
  persist,
  all,
  getOne,
  rowRoom,
};
