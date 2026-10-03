// =============================================================================
// FILE: server.js  —  Node.js / Express + Socket.io Backend  (v4)
// =============================================================================
// WHAT'S NEW IN v4:
//   • Users table with role-based auth (student / contractor / guard)
//   • /api/signup and /api/login endpoints
//   • Mock seed users for testing
//   • Delivery_Logs table: person name, mobile, hostel, in_time
//   • /api/delivery-logs GET (audit) and POST (submit) endpoints
//   • /audit-cancellations now returns student Name (not just roll_number)
// =============================================================================

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const sqlite3    = require('sqlite3').verbose();
const axios      = require('axios');
const cors       = require('cors');
const path       = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const PORT           = 3001;
const ML_SERVICE_URL = 'http://localhost:8000';
const MEAL_TYPES     = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];
const DAYS_OF_WEEK   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOSTELS        = ['Chitrakot', 'Mainpat', 'Sirpur', 'Mahanadi', 'Indravati', 'Malhar', 'Kotumsar', 'Seonath'];
const MEAL_SCALING   = { Breakfast: 0.62, Lunch: 1.00, Snacks: 0.48, Dinner: 0.87 };

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY HOSTEL DELIVERY COUNTS
// ─────────────────────────────────────────────────────────────────────────────
const hostelCounts = HOSTELS.reduce((acc, h) => ({ ...acc, [h]: 0 }), {});

// ─────────────────────────────────────────────────────────────────────────────
// EXPRESS APP + HTTP SERVER + SOCKET.IO
// ─────────────────────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
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

    // ── Users (role-based auth) ─────────────────────────────────────────────
    await runAsync(`
      CREATE TABLE IF NOT EXISTS Users (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        mobile_no   TEXT    NOT NULL,
        password    TEXT    NOT NULL,
        role        TEXT    NOT NULL CHECK(role IN ('student','contractor','guard')),
        hostel_name TEXT    NOT NULL DEFAULT ''
      )
    `);

    // ── Migration: add hostel_name column if DB was created before v5 ─────────
    try {
      await runAsync(`ALTER TABLE Users ADD COLUMN hostel_name TEXT NOT NULL DEFAULT ''`);
      console.log('🔄 Migration: added hostel_name column to Users');
    } catch { /* Column already exists — ignore */ }

    // ── Daily_Meals ────────────────────────────────────────────────────────
    const colCheck    = await allAsync(`PRAGMA table_info(Daily_Meals)`);
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

    // ── Leaves ─────────────────────────────────────────────────────────────
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

    // ── Hostel_Deliveries ──────────────────────────────────────────────────
    await runAsync(`
      CREATE TABLE IF NOT EXISTS Hostel_Deliveries (
        id     INTEGER PRIMARY KEY AUTOINCREMENT,
        date   TEXT    NOT NULL,
        hostel TEXT    NOT NULL,
        count  INTEGER NOT NULL DEFAULT 0,
        UNIQUE(date, hostel)
      )
    `);

    // ── Delivery_Logs (NEW v4) ─────────────────────────────────────────────
    // Stores full delivery person details logged by the security guard.
    await runAsync(`
      CREATE TABLE IF NOT EXISTS Delivery_Logs (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        hostel               TEXT    NOT NULL,
        delivery_person_name TEXT    NOT NULL,
        mobile_no            TEXT    NOT NULL,
        in_time              TEXT    NOT NULL,
        date                 TEXT    NOT NULL
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

    // ── SEED: Mock Users for testing ───────────────────────────────────────
    const { count: uc } = await getAsync('SELECT COUNT(*) as count FROM Users');
    if (uc === 0) {
      console.log('🌱 Seeding mock users…');
      const mockUsers = [
        { name: 'Navodit',         mobile_no: '9876543210', password: 'student123',    role: 'student',     hostel_name: 'Chitrakot' },
        { name: 'Rahul Sharma',    mobile_no: '9876543211', password: 'student456',    role: 'student',     hostel_name: 'Mainpat'   },
        { name: 'Priya Verma',     mobile_no: '9876543214', password: 'student789',    role: 'student',     hostel_name: 'Sirpur'    },
        { name: 'Mess Contractor', mobile_no: '9876543212', password: 'contractor123', role: 'contractor',  hostel_name: 'Chitrakot' },
        { name: 'Gate Guard',      mobile_no: '9876543213', password: 'guard123',      role: 'guard',       hostel_name: ''          },
      ];
      await runAsync('BEGIN TRANSACTION');
      for (const u of mockUsers) {
        await runAsync(
          'INSERT INTO Users (name, mobile_no, password, role, hostel_name) VALUES (?, ?, ?, ?, ?)',
          [u.name, u.mobile_no, u.password, u.role, u.hostel_name]
        );
      }
      await runAsync('COMMIT');
      console.log('✅ Mock users seeded!');
      console.log('   Student:    Navodit / student123');
      console.log('   Contractor: Mess Contractor / contractor123');
      console.log('   Guard:      Gate Guard / guard123');
    }

    // ── Ensure student users have matching Students table entries ─────────────
    // This links the Auth (Users) system with the meal cancellation (Students) system.
    const studentUsers = await allAsync("SELECT name FROM Users WHERE role = 'student'");
    for (const u of studentUsers) {
      const existing = await getAsync('SELECT id FROM Students WHERE LOWER(name) = LOWER(?)', [u.name]);
      if (!existing) {
        // Auto-generate a roll number from the name
        const roll = 'U' + u.name.replace(/\s+/g, '').toUpperCase().substring(0, 8);
        await runAsync('INSERT OR IGNORE INTO Students (name, roll_number) VALUES (?, ?)', [u.name, roll]);
        console.log(`  ↳ Created Students entry for: ${u.name} (${roll})`);
      }
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

    // ── LOAD TODAY'S HOSTEL DELIVERY COUNTS ───────────────────────────────
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
// SOCKET.IO REAL-TIME LAYER
// =============================================================================
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  socket.emit('delivery_count_updated', hostelCounts);

  socket.on('log_delivery', async ({ hostel }) => {
    if (!HOSTELS.includes(hostel)) {
      socket.emit('error', { message: `Unknown hostel: ${hostel}` });
      return;
    }
    hostelCounts[hostel] += 1;
    const newCount = hostelCounts[hostel];
    const today    = getTodayIST();
    console.log(`🛵 Delivery logged: ${hostel} → count now ${newCount}`);
    io.emit('delivery_count_updated', { ...hostelCounts });
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

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// =============================================================================
// ─────────────────────────────── HTTP ROUTES ─────────────────────────────────
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/signup
// Body: { name, mobile_no, password, role, hostel_name }
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/signup', async (req, res) => {
  const { name, mobile_no, password, role, hostel_name = '' } = req.body;
  if (!name || !mobile_no || !password || !role) {
    return res.status(400).json({ success: false, error: 'All fields are required.' });
  }
  if (!['student', 'contractor', 'guard'].includes(role)) {
    return res.status(400).json({ success: false, error: 'Invalid role.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
  }
  if ((role === 'student' || role === 'contractor') && !hostel_name) {
    return res.status(400).json({ success: false, error: 'Please select a hostel.' });
  }
  try {
    const result = await runAsync(
      'INSERT INTO Users (name, mobile_no, password, role, hostel_name) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), mobile_no.trim(), password, role, hostel_name.trim()]
    );

    // For student role: auto-create a Students entry so meal history works immediately
    if (role === 'student') {
      const roll = 'U' + name.trim().replace(/\s+/g, '').toUpperCase().substring(0, 8);
      await runAsync('INSERT OR IGNORE INTO Students (name, roll_number) VALUES (?, ?)', [name.trim(), roll]);
    }

    res.json({
      success: true, message: 'Account created successfully!',
      user: { id: result.lastID, name: name.trim(), role, hostel_name: hostel_name.trim() }
    });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return res.status(409).json({ success: false, error: 'An account with this name and role already exists.' });
    }
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/login
// Body: { name, password, role }
// Returns: { user: { id, name, role, hostel_name } }
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { name, password, role } = req.body;
  if (!name || !password || !role) {
    return res.status(400).json({ success: false, error: 'Name, password and role are required.' });
  }
  try {
    const user = await getAsync(
      'SELECT id, name, role, hostel_name FROM Users WHERE LOWER(name) = LOWER(?) AND password = ? AND role = ?',
      [name.trim(), password, role]
    );
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials. Check your name, password and role.' });
    }
    res.json({
      success: true, message: 'Login successful!',
      user: { id: user.id, name: user.name, role: user.role, hostel_name: user.hostel_name || '' }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ensure-student
// Body: { name } → Gets or creates a Students row for the given name
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/ensure-student', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ success: false, error: 'name is required.' });
  try {
    let student = await getAsync('SELECT id, name, roll_number FROM Students WHERE LOWER(name) = LOWER(?)', [name.trim()]);
    if (!student) {
      const roll = 'U' + name.trim().replace(/\s+/g, '').toUpperCase().substring(0, 8);
      const r    = await runAsync('INSERT OR IGNORE INTO Students (name, roll_number) VALUES (?, ?)', [name.trim(), roll]);
      student    = { id: r.lastID, name: name.trim(), roll_number: roll };
    }
    res.json({ success: true, student });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/meal-history/:student_id?days=14
// Returns the last N days of meal status for a student
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/meal-history/:student_id', async (req, res) => {
  const studentId = parseInt(req.params.student_id, 10);
  const days      = Math.min(parseInt(req.query.days || '14', 10), 90);
  if (!studentId) return res.status(400).json({ success: false, error: 'Invalid student_id.' });

  try {
    // Build list of the last N days (IST)
    const today  = getTodayIST();
    const dates  = [];
    const cursor = new Date(today + 'T00:00:00+05:30');
    for (let i = 0; i < days; i++) {
      const d = cursor.toISOString().split('T')[0];
      dates.push(d);
      cursor.setDate(cursor.getDate() - 1);
    }

    // Fetch all meal records in that range
    const earliest = dates[dates.length - 1];
    const rows = await allAsync(
      `SELECT date, meal_type, cancelled, cancelled_at
       FROM Daily_Meals
       WHERE student_id = ? AND date BETWEEN ? AND ?
       ORDER BY date DESC, meal_type`,
      [studentId, earliest, today]
    );

    // Build a map: { date → { Breakfast: {...}, Lunch: {...}, ... } }
    const mealMap = {};
    for (const row of rows) {
      if (!mealMap[row.date]) mealMap[row.date] = {};
      mealMap[row.date][row.meal_type] = {
        cancelled:    row.cancelled,
        cancelled_at: row.cancelled_at,
      };
    }

    // Only include dates that have at least one record
    const history = dates
      .filter(d => mealMap[d])
      .map(d => ({
        date:  d,
        meals: {
          Breakfast: mealMap[d]['Breakfast'] || { cancelled: 0, cancelled_at: null },
          Lunch:     mealMap[d]['Lunch']     || { cancelled: 0, cancelled_at: null },
          Snacks:    mealMap[d]['Snacks']    || { cancelled: 0, cancelled_at: null },
          Dinner:    mealMap[d]['Dinner']    || { cancelled: 0, cancelled_at: null },
        }
      }));

    res.json({ success: true, student_id: studentId, days, history });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/leaderboard
// Returns top 15 students by cancellations this month (10 pts each)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/leaderboard', async (req, res) => {
  const month = getTodayIST().substring(0, 7); // 'YYYY-MM'
  try {
    const rows = await allAsync(`
      SELECT s.name, COUNT(*) AS cancellations
      FROM Daily_Meals dm
      JOIN Students s ON s.id = dm.student_id
      WHERE dm.cancelled = 1 AND dm.date LIKE ?
      GROUP BY dm.student_id, s.name
      ORDER BY cancellations DESC
      LIMIT 15
    `, [`${month}%`]);

    const leaderboard = rows.map(r => ({
      name:          r.name,
      cancellations: r.cancellations,
      points:        r.cancellations * 10,
    }));

    res.json({ success: true, month, leaderboard });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

// POST /api/delivery-logs — Guard submits a delivery log entry
// Body: { hostel, delivery_person_name, mobile_no, in_time }
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/delivery-logs', async (req, res) => {
  const { hostel, delivery_person_name, mobile_no, in_time } = req.body;
  if (!hostel || !delivery_person_name || !mobile_no || !in_time) {
    return res.status(400).json({ success: false, error: 'hostel, delivery_person_name, mobile_no, in_time are required.' });
  }
  if (!HOSTELS.includes(hostel)) {
    return res.status(400).json({ success: false, error: `Unknown hostel: ${hostel}` });
  }
  const today = getTodayIST();
  try {
    const result = await runAsync(
      'INSERT INTO Delivery_Logs (hostel, delivery_person_name, mobile_no, in_time, date) VALUES (?, ?, ?, ?, ?)',
      [hostel, delivery_person_name.trim(), mobile_no.trim(), in_time, today]
    );
    // Also emit the socket event to update hostel counts
    hostelCounts[hostel] = (hostelCounts[hostel] || 0) + 1;
    const newCount = hostelCounts[hostel];
    io.emit('delivery_count_updated', { ...hostelCounts });
    try {
      await runAsync(`
        INSERT INTO Hostel_Deliveries (date, hostel, count)
        VALUES (?, ?, ?)
        ON CONFLICT(date, hostel) DO UPDATE SET count = excluded.count
      `, [today, hostel, newCount]);
    } catch (_) {}

    res.json({ success: true, message: 'Delivery log saved!', id: result.lastID });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/delivery-logs?date=YYYY-MM-DD — Get delivery audit log
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/delivery-logs', async (req, res) => {
  const date = req.query.date || getTodayIST();
  try {
    const logs = await allAsync(
      'SELECT id, hostel, delivery_person_name, mobile_no, in_time, date FROM Delivery_Logs WHERE date = ? ORDER BY id DESC',
      [date]
    );
    res.json({ success: true, date, logs });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /hostel-deliveries?date=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────────────────────
app.get('/hostel-deliveries', async (req, res) => {
  const date = req.query.date || getTodayIST();
  if (date === getTodayIST()) {
    return res.json({ success: true, date, counts: { ...hostelCounts } });
  }
  try {
    const rows   = await allAsync('SELECT hostel, count FROM Hostel_Deliveries WHERE date = ?', [date]);
    const counts = HOSTELS.reduce((acc, h) => ({ ...acc, [h]: 0 }), {});
    for (const row of rows) { if (counts.hasOwnProperty(row.hostel)) counts[row.hostel] = row.count; }
    res.json({ success: true, date, counts });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /hostels
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
// v4: returns student Name prominently (not just roll_number)
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
    res.json({
      success: true, date,
      total_cancellations: cancellations.length,
      unique_students: new Set(cancellations.map(c => c.student_id)).size,
      spam_threshold: SPAM_THRESHOLD,
      cancellations: cancellations.map(c => ({ ...c, is_frequent: c.monthly_count >= SPAM_THRESHOLD }))
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /dashboard
// ─────────────────────────────────────────────────────────────────────────────
app.get('/dashboard', async (req, res) => {
  const today          = getTodayIST();
  const TOTAL_ENROLLED = 500;
  const weather        = req.query.weather        || 'Clear';
  const menu_item      = req.query.menu_item      || 'Paneer';
  const meal_type      = req.query.meal_type      || 'Lunch';
  const hostel         = req.query.hostel;

  const liveCount        = hostel && HOSTELS.includes(hostel) ? hostelCounts[hostel] : 0;
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
      live_delivery_count: liveCount,
      derived_traffic_level: delivery_traffic,
      hostel: hostel || null,
      model_info: mlPrediction ? mlPrediction.model_info : null,
      ml_error: mlError,
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// =============================================================================
// START SERVER
// =============================================================================
server.listen(PORT, () => {
  console.log('\n' + '='.repeat(62));
  console.log('🚀  Mess Forecasting Backend v4 (Auth + Delivery Logs) is LIVE!');
  console.log(`📡  HTTP  → http://localhost:${PORT}`);
  console.log(`🔌  WS    → ws://localhost:${PORT}`);
  console.log(`🤖  ML    → ${ML_SERVICE_URL}`);
  console.log('='.repeat(62) + '\n');
});
