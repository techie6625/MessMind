// =============================================================================
// FILE: server.js  —  Node.js / Express + Socket.io Backend  (v3)
// =============================================================================
// WHAT'S NEW IN v3:
//   • Socket.io real-time layer for Gate Security Module
//   • Per-hostel delivery count tracking (in-memory + SQLite persistence)
//   • 'log_delivery' event → increment count → broadcast 'delivery_count_updated'
//   • GET /hostel-deliveries endpoint for initial state on page load
// =============================================================================

const express  = require('express');
const http     = require('http');         // Node's built-in HTTP module
const { Server } = require('socket.io'); // Socket.io server class
const sqlite3  = require('sqlite3').verbose();
const axios    = require('axios');
const cors     = require('cors');
const path     = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const PORT           = 3001;
const ML_SERVICE_URL = 'http://localhost:8000';
const MEAL_TYPES     = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];
const DAYS_OF_WEEK   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// The 8 campus hostels — single source of truth used by both guard UI and dashboard
const HOSTELS = ['Chitrakot', 'Mainpat', 'Sirpur', 'Mahanadi', 'Indravati', 'Malhar', 'Kotumsar', 'Seonath'];

// Per-meal scaling factors (ML model predicts total attendance; scale for each meal)
const MEAL_SCALING = { Breakfast: 0.62, Lunch: 1.00, Snacks: 0.48, Dinner: 0.87 };

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY HOSTEL DELIVERY COUNTS
// Structure: { Chitrakot: 5, Mainpat: 2, ... }
// This is the source of truth for Socket.io real-time events.
// It is seeded from SQLite on startup and synced back on every update.
// WHY IN-MEMORY?  Socket.io needs to broadcast instantly. A DB round-trip
// on every button tap would add latency. We keep the DB as a durable backup.
// ─────────────────────────────────────────────────────────────────────────────
const hostelCounts = HOSTELS.reduce((acc, h) => ({ ...acc, [h]: 0 }), {});
// Initialises to: { Chitrakot: 0, Mainpat: 0, Sirpur: 0, ... Seonath: 0 }

// ─────────────────────────────────────────────────────────────────────────────
// EXPRESS APP + HTTP SERVER + SOCKET.IO
// WHY http.createServer(app)?
//   Socket.io needs access to the raw HTTP server (not just Express).
//   We attach Socket.io to the same server so both REST API and WebSocket
//   traffic share port 3001. No extra port needed!
// ─────────────────────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app); // Wrap Express in a native HTTP server

const io = new Server(server, {
  // CORS must match the React dev server's origin
  cors: {
    origin:  'http://localhost:3000',
    methods: ['GET', 'POST'],
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────
app.use(cors({ origin: 'http://localhost:3000', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(express.json());

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE SETUP
// ─────────────────────────────────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, 'mess.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) { console.error('❌ DB open failed:', err.message); process.exit(1); }
  console.log(`✅ SQLite connected: ${DB_PATH}`);
});
db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA foreign_keys = ON');

// ─────────────────────────────────────────────────────────────────────────────
// PROMISE WRAPPERS
// ─────────────────────────────────────────────────────────────────────────────
const runAsync = (sql, p = []) => new Promise((res, rej) =>
  db.run(sql, p, function(e) { e ? rej(e) : res(this); })
);
const getAsync = (sql, p = []) => new Promise((res, rej) =>
  db.get(sql, p, (e, row) => e ? rej(e) : res(row))
);
const allAsync = (sql, p = []) => new Promise((res, rej) =>
  db.all(sql, p, (e, rows) => e ? rej(e) : res(rows))
);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const getTodayIST = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const getDayName = (dateStr) =>
  DAYS_OF_WEEK[new Date(dateStr + 'T00:00:00').getDay()];

const getDatesInRange = (startStr, endStr) => {
  const dates = [];
  const cur   = new Date(startStr + 'T00:00:00');
  const end   = new Date(endStr   + 'T00:00:00');
  while (cur <= end) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
};

// Map a raw delivery count → ML traffic level string
// This lets the guard's taps directly influence the ML model's predictions!
const countToTrafficLevel = (count) => {
  if (count >= 8) return 'High';
  if (count >= 3) return 'Medium';
  return 'Low';
};

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE INITIALISATION
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  try {
    // ── Students ───────────────────────────────────────────────────────────
    await runAsync(`
      CREATE TABLE IF NOT EXISTS Students (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        roll_number TEXT    UNIQUE NOT NULL
      )
    `);

    // ── Daily_Meals (v2: includes meal_type) ───────────────────────────────
    const colCheck   = await allAsync(`PRAGMA table_info(Daily_Meals)`);
    const hasMealType = colCheck.some(c => c.name === 'meal_type');
    if (!hasMealType && colCheck.length > 0) {
      await runAsync(`DROP TABLE IF EXISTS Daily_Meals`);
    }
    await runAsync(`
      CREATE TABLE IF NOT EXISTS Daily_Meals (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id   INTEGER NOT NULL,
        date         TEXT    NOT NULL,
        meal_type    TEXT    NOT NULL DEFAULT 'Lunch',
        cancelled    INTEGER DEFAULT 0,
        cancelled_at DATETIME,
        UNIQUE(student_id, date, meal_type),
        FOREIGN KEY (student_id) REFERENCES Students(id)
      )
    `);

    // ── Weekly_Menu ────────────────────────────────────────────────────────
    await runAsync(`
      CREATE TABLE IF NOT EXISTS Weekly_Menu (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        day_of_week TEXT    NOT NULL,
        meal_type   TEXT    NOT NULL,
        items       TEXT    NOT NULL DEFAULT '',
        UNIQUE(day_of_week, meal_type)
      )
    `);

    // ── Leaves ────────────────────────────────────────────────────────────
    await runAsync(`
      CREATE TABLE IF NOT EXISTS Leaves (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        start_date TEXT    NOT NULL,
        end_date   TEXT    NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES Students(id)
      )
    `);

    // ── NEW: Hostel_Deliveries — persists daily delivery counts per hostel ─
    // This table survives server restarts. Each row = (date, hostel, count).
    // UNIQUE(date, hostel) means one row per hostel per day — upsertable.
    await runAsync(`
      CREATE TABLE IF NOT EXISTS Hostel_Deliveries (
        id     INTEGER PRIMARY KEY AUTOINCREMENT,
        date   TEXT    NOT NULL,
        hostel TEXT    NOT NULL,
        count  INTEGER NOT NULL DEFAULT 0,
        UNIQUE(date, hostel)
      )
    `);

    // ── SEED: 500 Students ─────────────────────────────────────────────────
    const { count: sc } = await getAsync('SELECT COUNT(*) as count FROM Students');
    if (sc === 0) {
      console.log('🌱 Seeding 500 students…');
      await runAsync('BEGIN TRANSACTION');
      for (let i = 1; i <= 500; i++) {
        const p = String(i).padStart(3, '0');
        await runAsync('INSERT OR IGNORE INTO Students (name, roll_number) VALUES (?, ?)', [`Student_${p}`, `ROLL${p}`]);
      }
      await runAsync('COMMIT');
      console.log('✅ 500 students seeded!');
    }

    // ── SEED: Weekly Menu ──────────────────────────────────────────────────
    const { count: mc } = await getAsync('SELECT COUNT(*) as count FROM Weekly_Menu');
    if (mc === 0) {
      console.log('🌱 Seeding default weekly menu…');
      const defaultMenu = {
        Monday:    { Breakfast: 'Idli, Sambar, Coconut Chutney, Banana',        Lunch: 'Dal Tadka, Jeera Rice, Phulka, Mixed Veg, Salad',     Snacks: 'Bread Pakora, Masala Chai',          Dinner: 'Paneer Butter Masala, Butter Naan, Rice, Raita'     },
        Tuesday:   { Breakfast: 'Poha, Boiled Eggs, Tea, Fruit',                Lunch: 'Rajma Chawal, Roti, Boondi Raita, Pickle',            Snacks: 'Vada Pav, Ginger Tea',               Dinner: 'Dal Makhani, Tawa Roti, Jeera Rice, Papad'          },
        Wednesday: { Breakfast: 'Upma, Peanut Chutney, Coffee, Orange',         Lunch: 'Chhole, Bhature, Onion Salad, Lassi',                 Snacks: 'Dhokla, Tamarind Chutney, Tea',      Dinner: 'Mix Veg Curry, Chapati, Rice, Curd'                 },
        Thursday:  { Breakfast: 'Puri Bhaji, Pickle, Tea',                      Lunch: 'Kadhi Pakora, Rice, Phulka, Papad, Salad',            Snacks: 'Aloo Tikki, Mint Chutney, Tea',      Dinner: 'Butter Chicken / Paneer, Naan, Rice, Gulab Jamun'   },
        Friday:    { Breakfast: 'Dosa, Coconut Chutney, Sambar, Coffee',        Lunch: 'Pulao, Raita, Soya Curry, Roti, Salad',               Snacks: 'Matar Kulcha, Chai',                 Dinner: 'Dal Fry, Jeera Rice, Roti, Halwa'                   },
        Saturday:  { Breakfast: 'Aloo Paratha, Butter, Curd, Tea',              Lunch: 'Biryani, Mirchi ka Salan, Raita, Papad',              Snacks: 'Samosa, Chaat, Cold Drink',          Dinner: 'Mutton / Paneer Kofta, Chapati, Rice, Ice Cream'    },
        Sunday:    { Breakfast: 'Bread Omelette, Cornflakes, Milk, Juice',      Lunch: 'Chole Bhature, Raita, Salad, Lassi',                  Snacks: 'Popcorn, Juice, Biscuits',           Dinner: 'Dal Makhani, Shahi Paneer, Naan, Rice, Kheer'       },
      };
      await runAsync('BEGIN TRANSACTION');
      for (const [day, meals] of Object.entries(defaultMenu)) {
        for (const [mealType, items] of Object.entries(meals)) {
          await runAsync('INSERT OR IGNORE INTO Weekly_Menu (day_of_week, meal_type, items) VALUES (?, ?, ?)', [day, mealType, items]);
        }
      }
      await runAsync('COMMIT');
      console.log('✅ Weekly menu seeded!');
    }

    // ── LOAD TODAY'S HOSTEL DELIVERY COUNTS into in-memory object ──────────
    // On server restart, we restore today's counts from SQLite so they're
    // not lost. This makes the system restart-safe.
    const today = getTodayIST();
    const existingCounts = await allAsync(
      'SELECT hostel, count FROM Hostel_Deliveries WHERE date = ?', [today]
    );
    for (const row of existingCounts) {
      if (hostelCounts.hasOwnProperty(row.hostel)) {
        hostelCounts[row.hostel] = row.count;
      }
    }
    console.log('✅ Today\'s hostel delivery counts loaded:', hostelCounts);
    console.log('✅ All DB tables ready.');

  } catch (err) {
    console.error('❌ DB init failed:', err);
  }
})();

// =============================================================================
// ─────────────────── SOCKET.IO REAL-TIME LAYER ───────────────────────────────
// =============================================================================
//
// HOW SOCKET.IO WORKS:
//   1. The React GateGuardApp connects to this server via WebSocket (ws://)
//   2. When a guard taps a hostel button, the client emits 'log_delivery'
//   3. This server increments the hostel count, persists to SQLite,
//      then broadcasts 'delivery_count_updated' to ALL connected clients
//   4. Every open dashboard and guard app receives the update instantly
//
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // ── SEND CURRENT STATE TO NEWLY CONNECTED CLIENT ──────────────────────
  // When a new browser tab connects, send them the current counts immediately
  // so they don't see zeroes while waiting for the next event.
  socket.emit('delivery_count_updated', hostelCounts);

  // ── HANDLE 'log_delivery' EVENT ────────────────────────────────────────
  // Fired by the GateGuardApp when a guard taps a hostel button.
  // Payload: { hostel: 'Seonath' }
  socket.on('log_delivery', async ({ hostel }) => {
    // Validate: hostel must be one of the 8 known hostels
    if (!HOSTELS.includes(hostel)) {
      socket.emit('error', { message: `Unknown hostel: ${hostel}` });
      return;
    }

    // ── INCREMENT IN-MEMORY COUNT ─────────────────────────────────────
    // This is instantaneous — no DB wait before broadcasting
    hostelCounts[hostel] += 1;
    const newCount = hostelCounts[hostel];
    const today    = getTodayIST();

    console.log(`🛵 Delivery logged: ${hostel} → count now ${newCount}`);

    // ── BROADCAST TO ALL CONNECTED CLIENTS ───────────────────────────
    // io.emit() sends to ALL connected sockets (not just the sender).
    // This is what makes it "live" — every open dashboard updates instantly.
    io.emit('delivery_count_updated', { ...hostelCounts }); // Spread to send a copy

    // ── PERSIST TO SQLITE (async — doesn't block the broadcast) ──────
    // INSERT OR REPLACE upserts: inserts a new row the first time,
    // replaces it on subsequent taps (updating the count).
    try {
      await runAsync(`
        INSERT INTO Hostel_Deliveries (date, hostel, count)
        VALUES (?, ?, ?)
        ON CONFLICT(date, hostel) DO UPDATE SET count = excluded.count
      `, [today, hostel, newCount]);
    } catch (err) {
      console.error(`❌ Failed to persist delivery count for ${hostel}:`, err.message);
    }
  });

  // ── HANDLE DISCONNECT ────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// =============================================================================
// ─────────────────────────────── HTTP ROUTES ─────────────────────────────────
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// GET /hostel-deliveries?date=YYYY-MM-DD
// Returns today's (or a specific date's) delivery counts for all 8 hostels.
// Used to initialise the dashboard on first load (before Socket.io fires).
// ─────────────────────────────────────────────────────────────────────────────
app.get('/hostel-deliveries', async (req, res) => {
  const date = req.query.date || getTodayIST();

  // For today, serve from the fast in-memory object
  if (date === getTodayIST()) {
    return res.json({ success: true, date, counts: { ...hostelCounts } });
  }

  // For historical dates, query SQLite
  try {
    const rows  = await allAsync('SELECT hostel, count FROM Hostel_Deliveries WHERE date = ?', [date]);
    const counts = HOSTELS.reduce((acc, h) => ({ ...acc, [h]: 0 }), {});
    for (const row of rows) { if (counts.hasOwnProperty(row.hostel)) counts[row.hostel] = row.count; }
    res.json({ success: true, date, counts });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /hostels — returns the list of 8 hostels (used by UI to avoid hardcoding)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/hostels', (req, res) => {
  res.json({ success: true, hostels: HOSTELS });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /students
// ─────────────────────────────────────────────────────────────────────────────
app.get('/students', async (req, res) => {
  try {
    const students = await allAsync('SELECT id, name, roll_number FROM Students LIMIT 10');
    res.json({ success: true, students });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /meal-status/:student_id/:date
// ─────────────────────────────────────────────────────────────────────────────
app.get('/meal-status/:student_id/:date', async (req, res) => {
  const studentId = parseInt(req.params.student_id, 10);
  const date      = req.params.date;
  try {
    const rows = await allAsync(
      'SELECT meal_type, cancelled FROM Daily_Meals WHERE student_id = ? AND date = ?',
      [studentId, date]
    );
    const statuses = { Breakfast: false, Lunch: false, Snacks: false, Dinner: false };
    for (const row of rows) statuses[row.meal_type] = row.cancelled === 1;
    res.json({ success: true, student_id: studentId, date, statuses });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /cancel-meal
// Body: { student_id, date, meal_type }
// ─────────────────────────────────────────────────────────────────────────────
app.post('/cancel-meal', async (req, res) => {
  const { student_id, date, meal_type } = req.body;
  if (!student_id || !date || !meal_type) return res.status(400).json({ success: false, error: 'student_id, date, and meal_type are required.' });
  if (!MEAL_TYPES.includes(meal_type)) return res.status(400).json({ success: false, error: `Invalid meal_type.` });

  try {
    const existing = await getAsync(
      'SELECT id, cancelled FROM Daily_Meals WHERE student_id = ? AND date = ? AND meal_type = ?',
      [student_id, date, meal_type]
    );
    if (!existing) {
      await runAsync('INSERT INTO Daily_Meals (student_id, date, meal_type, cancelled, cancelled_at) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)', [student_id, date, meal_type]);
      return res.json({ success: true, action: 'cancelled', meal_type, message: `${meal_type} cancelled for ${date}.` });
    } else if (existing.cancelled === 1) {
      await runAsync('UPDATE Daily_Meals SET cancelled = 0, cancelled_at = NULL WHERE student_id = ? AND date = ? AND meal_type = ?', [student_id, date, meal_type]);
      return res.json({ success: true, action: 'reinstated', meal_type, message: `${meal_type} reinstated for ${date}.` });
    } else {
      await runAsync('UPDATE Daily_Meals SET cancelled = 1, cancelled_at = CURRENT_TIMESTAMP WHERE student_id = ? AND date = ? AND meal_type = ?', [student_id, date, meal_type]);
      return res.json({ success: true, action: 'cancelled', meal_type, message: `${meal_type} cancelled for ${date}.` });
    }
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /menu/:date and GET /menu-week
// ─────────────────────────────────────────────────────────────────────────────
app.get('/menu/:date', async (req, res) => {
  const dateStr = req.params.date;
  const dayName = getDayName(dateStr);
  try {
    const rows = await allAsync('SELECT meal_type, items FROM Weekly_Menu WHERE day_of_week = ?', [dayName]);
    const menu = { Breakfast: '', Lunch: '', Snacks: '', Dinner: '' };
    for (const row of rows) menu[row.meal_type] = row.items;
    res.json({ success: true, date: dateStr, day: dayName, menu });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/menu-week', async (req, res) => {
  try {
    const rows = await allAsync('SELECT day_of_week, meal_type, items FROM Weekly_Menu');
    const weekMenu = {};
    for (const day of DAYS_OF_WEEK) weekMenu[day] = { Breakfast: '', Lunch: '', Snacks: '', Dinner: '' };
    for (const row of rows) { if (weekMenu[row.day_of_week]) weekMenu[row.day_of_week][row.meal_type] = row.items; }
    res.json({ success: true, menu: weekMenu });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /menu
// ─────────────────────────────────────────────────────────────────────────────
app.put('/menu', async (req, res) => {
  const menuData = req.body;
  if (!menuData || typeof menuData !== 'object') return res.status(400).json({ success: false, error: 'Invalid body.' });
  try {
    await runAsync('BEGIN TRANSACTION');
    for (const [day, meals] of Object.entries(menuData)) {
      if (!DAYS_OF_WEEK.includes(day)) continue;
      for (const [mealType, items] of Object.entries(meals)) {
        if (!MEAL_TYPES.includes(mealType)) continue;
        await runAsync('INSERT OR REPLACE INTO Weekly_Menu (day_of_week, meal_type, items) VALUES (?, ?, ?)', [day, mealType, items || '']);
      }
    }
    await runAsync('COMMIT');
    res.json({ success: true, message: 'Weekly menu updated.' });
  } catch (e) {
    await runAsync('ROLLBACK').catch(() => {});
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /apply-leave
// ─────────────────────────────────────────────────────────────────────────────
app.post('/apply-leave', async (req, res) => {
  const { student_id, start_date, end_date } = req.body;
  if (!student_id || !start_date || !end_date) return res.status(400).json({ success: false, error: 'student_id, start_date, end_date required.' });
  if (new Date(end_date) < new Date(start_date)) return res.status(400).json({ success: false, error: 'end_date must be on or after start_date.' });
  try {
    const student = await getAsync('SELECT id, name FROM Students WHERE id = ?', [student_id]);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found.' });
    await runAsync('INSERT INTO Leaves (student_id, start_date, end_date) VALUES (?, ?, ?)', [student_id, start_date, end_date]);
    const dates = getDatesInRange(start_date, end_date);
    let totalCancelled = 0;
    await runAsync('BEGIN TRANSACTION');
    for (const date of dates) {
      for (const mealType of MEAL_TYPES) {
        await runAsync('INSERT OR REPLACE INTO Daily_Meals (student_id, date, meal_type, cancelled, cancelled_at) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)', [student_id, date, mealType]);
        totalCancelled++;
      }
    }
    await runAsync('COMMIT');
    res.json({ success: true, message: `Leave applied for ${student.name}. ${dates.length} day(s), ${totalCancelled} meals cancelled.`, student_name: student.name, days_count: dates.length, meals_cancelled: totalCancelled, start_date, end_date });
  } catch (e) {
    await runAsync('ROLLBACK').catch(() => {});
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /audit-cancellations?date=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────────────────────
app.get('/audit-cancellations', async (req, res) => {
  const date  = req.query.date || getTodayIST();
  const month = date.substring(0, 7);
  try {
    const cancellations = await allAsync(`
      SELECT dm.id, dm.student_id, s.name, s.roll_number, dm.meal_type, dm.cancelled_at, dm.date,
        (SELECT COUNT(*) FROM Daily_Meals dm2 WHERE dm2.student_id = dm.student_id AND dm2.cancelled = 1 AND dm2.date LIKE ?) AS monthly_count
      FROM Daily_Meals dm
      JOIN Students s ON s.id = dm.student_id
      WHERE dm.date = ? AND dm.cancelled = 1
      ORDER BY dm.cancelled_at DESC
    `, [`${month}%`, date]);
    const SPAM_THRESHOLD = 15;
    res.json({ success: true, date, total_cancellations: cancellations.length, unique_students: new Set(cancellations.map(c => c.student_id)).size, spam_threshold: SPAM_THRESHOLD, cancellations: cancellations.map(c => ({ ...c, is_frequent: c.monthly_count >= SPAM_THRESHOLD })) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /dashboard?weather&menu_item&delivery_traffic&meal_type&hostel
// Now accepts an optional `hostel` param. When provided, the delivery_traffic
// is auto-derived from that hostel's live count (overrides manual selection).
// ─────────────────────────────────────────────────────────────────────────────
app.get('/dashboard', async (req, res) => {
  const today          = getTodayIST();
  const TOTAL_ENROLLED = 500;
  const weather        = req.query.weather        || 'Clear';
  const menu_item      = req.query.menu_item      || 'Paneer';
  const meal_type      = req.query.meal_type      || 'Lunch';
  const hostel         = req.query.hostel;  // Optional hostel filter

  // If a hostel is specified, auto-derive delivery_traffic from live count.
  // This is the KEY integration: gate guard taps update ML predictions live!
  const liveCount      = hostel && HOSTELS.includes(hostel) ? hostelCounts[hostel] : 0;
  const delivery_traffic = hostel ? countToTrafficLevel(liveCount) : (req.query.delivery_traffic || 'Low');

  if (!MEAL_TYPES.includes(meal_type)) return res.status(400).json({ success: false, error: 'Invalid meal_type.' });

  try {
    const { count: mealCancellations } = await getAsync(
      'SELECT COUNT(*) as count FROM Daily_Meals WHERE date = ? AND meal_type = ? AND cancelled = 1', [today, meal_type]
    );
    const { count: totalCancellations } = await getAsync(
      'SELECT COUNT(*) as count FROM Daily_Meals WHERE date = ? AND cancelled = 1', [today]
    );
    const potentialAttendees = TOTAL_ENROLLED - mealCancellations;

    let mlPrediction = null, mlError = null;
    try {
      const mlResponse = await axios.post(`${ML_SERVICE_URL}/predict`, { weather, menu_item, delivery_traffic }, { timeout: 5000 });
      mlPrediction = mlResponse.data;
    } catch (mlErr) {
      mlError = `ML service unavailable: ${mlErr.message}`;
    }

    const scale                  = MEAL_SCALING[meal_type] || 1.0;
    const rawMLPrediction        = mlPrediction ? mlPrediction.predicted_attendance : potentialAttendees;
    const mealSpecificPrediction = Math.round(rawMLPrediction * scale);
    const unreportedAbsences     = Math.max(0, potentialAttendees - mealSpecificPrediction);
    const finalPlatesToCook      = potentialAttendees - unreportedAbsences;

    res.json({
      success: true, date: today, meal_type,
      total_enrolled: TOTAL_ENROLLED,
      manual_cancellations: mealCancellations,
      total_cancellations: totalCancellations,
      potential_attendees: potentialAttendees,
      raw_ml_prediction: rawMLPrediction,
      meal_scale_factor: scale,
      predicted_attendance: mealSpecificPrediction,
      unreported_absences: unreportedAbsences,
      final_plates_to_cook: finalPlatesToCook,
      conditions: { weather, menu_item, delivery_traffic },
      live_delivery_count: liveCount,           // Hostel's live count from guard app
      derived_traffic_level: delivery_traffic,  // What we fed to the ML model
      hostel: hostel || null,
      model_info: mlPrediction ? mlPrediction.model_info : null,
      ml_error: mlError,
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// =============================================================================
// START SERVER — NOTE: server.listen() not app.listen()!
// We must call server.listen() (not app.listen()) because Socket.io is
// attached to the HTTP server, not the Express app.
// =============================================================================
server.listen(PORT, () => {
  console.log('\n' + '='.repeat(62));
  console.log('🚀  Mess Forecasting Backend v3 (Socket.io) is LIVE!');
  console.log(`📡  HTTP  → http://localhost:${PORT}`);
  console.log(`🔌  WS    → ws://localhost:${PORT}`);
  console.log(`🤖  ML    → ${ML_SERVICE_URL}`);
  console.log('='.repeat(62) + '\n');
});
