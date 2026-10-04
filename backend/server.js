// =============================================================================
// FILE: server.js  —  Node.js / Express + Socket.io Backend  (v5)
// =============================================================================
// WHAT'S NEW IN v5:
//   • Purchases table for contractor bills (warden finance view)
//   • telegram_chat_id column on Users for bot linking
//   • GET /api/warden-stats  — live KPIs for the Warden Dashboard
//   • Telegram bot: /start <phone> → links chat_id in DB
//   • GET /api/trigger-bot-lunch → demo button that blasts Telegram notifications
//   • Callback queries handle inline-keyboard cancellations from Telegram
// =============================================================================

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const sqlite3    = require('sqlite3').verbose();
const axios      = require('axios');
const cors       = require('cors');
const path       = require('path');
// Telegram Bot API — polling mode (no webhook needed for local hackathon demo)
const TelegramBot = require('node-telegram-bot-api');
// node-cron — for scheduled notifications (optional; bot can also be triggered manually)
const cron        = require('node-cron');

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const PORT           = 3001;
const ML_SERVICE_URL = 'http://localhost:8000';
const MEAL_TYPES     = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];
const DAYS_OF_WEEK   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOSTELS        = ['Chitrakot', 'Mainpat', 'Sirpur', 'Mahanadi', 'Indravati', 'Malhar', 'Kotumsar', 'Seonath'];
const MEAL_SCALING   = { Breakfast: 0.62, Lunch: 1.00, Snacks: 0.48, Dinner: 0.87 };

// ── Telegram Bot Token ─────────────────────────────────────────────────────────
// Replace the string below with your real BotFather token before the demo.
// Example: '7123456789:AAGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY HOSTEL DELIVERY COUNTS
// ─────────────────────────────────────────────────────────────────────────────
const hostelCounts = HOSTELS.reduce((acc, h) => ({ ...acc, [h]: 0 }), {});

// ─────────────────────────────────────────────────────────────────────────────
// TELEGRAM BOT INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────
// polling: true — the bot continuously asks Telegram's servers for new messages.
// This is perfect for a hackathon: no public URL / webhook needed.
// The bot is only active when the token is real (not the placeholder string).
let bot = null;
if (TELEGRAM_BOT_TOKEN && TELEGRAM_BOT_TOKEN !== 'YOUR_BOT_TOKEN_HERE') {
  try {
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
    console.log('🤖 Telegram bot polling started.');
  } catch (err) {
    console.warn('⚠️  Telegram bot failed to start:', err.message);
  }
} else {
  console.log('ℹ️  Telegram bot disabled (no token set). Set TELEGRAM_BOT_TOKEN env var to enable.');
}

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
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        name             TEXT    NOT NULL,
        mobile_no        TEXT    NOT NULL,
        password         TEXT    NOT NULL,
        role             TEXT    NOT NULL,
        hostel_name      TEXT    NOT NULL DEFAULT '',
        telegram_chat_id TEXT    DEFAULT NULL,
        UNIQUE(name, role)
      )
    `);

    // ── Migration: add hostel_name column if DB was created before v5 ─────────
    try {
      await runAsync(`ALTER TABLE Users ADD COLUMN hostel_name TEXT NOT NULL DEFAULT ''`);
      console.log('🔄 Migration: added hostel_name column to Users');
    } catch { /* Column already exists — ignore */ }

    // ── Migration: add telegram_chat_id for Telegram bot linking ─────────────
    // This lets students link their Telegram account via /start <phone_number>.
    // Once linked, the bot can DM them meal notifications.
    try {
      await runAsync(`ALTER TABLE Users ADD COLUMN telegram_chat_id TEXT DEFAULT NULL`);
      console.log('🔄 Migration: added telegram_chat_id column to Users');
    } catch { /* Column already exists — ignore */ }

    // ── Migration: add cancel_reason / reason column to Daily_Meals ─────────
    // WHY: We need to distinguish "Ordered online" cancellations from other
    // reasons (going home, no appetite) to prevent double-counting in the
    // plate formula when the security guard also logs a food delivery.
    try {
      await runAsync(`ALTER TABLE Daily_Meals ADD COLUMN cancel_reason TEXT DEFAULT ''`);
    } catch { /* Column already exists — ignore */ }
    try {
      await runAsync(`ALTER TABLE Daily_Meals ADD COLUMN reason TEXT DEFAULT ''`);
      console.log('🔄 Migration: added reason column to Daily_Meals');
    } catch { /* Column already exists — ignore */ }

    // ── Purchases (contractor bill uploads / expense records) ─────────────────
    // The Warden Dashboard's "Finance" KPI reads from this table.
    // A contractor uses this to log each purchase (raw materials, gas, etc.).
    await runAsync(`
      CREATE TABLE IF NOT EXISTS Purchases (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT    NOT NULL,
        amount      REAL    NOT NULL DEFAULT 0,
        date_bought TEXT    NOT NULL,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ── Daily_Meals ────────────────────────────────────────────────────────
    const colCheck    = await allAsync(`PRAGMA table_info(Daily_Meals)`);
    const hasMealType = colCheck.some(c => c.name === 'meal_type');
    if (!hasMealType && colCheck.length > 0) {
      await runAsync(`DROP TABLE IF EXISTS Daily_Meals`);
    }
    await runAsync(`
      CREATE TABLE IF NOT EXISTS Daily_Meals (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id    INTEGER NOT NULL,
        date          TEXT    NOT NULL,
        meal_type     TEXT    NOT NULL DEFAULT 'Lunch',
        cancelled     INTEGER DEFAULT 0,
        cancelled_at  DATETIME,
        reason        TEXT    DEFAULT '',
        cancel_reason TEXT    DEFAULT '',
        UNIQUE(student_id, date, meal_type),
        FOREIGN KEY (student_id) REFERENCES Students(id)
      )
    `);

    // ── Ratings (anonymous post-meal ratings) ──────────────────────────────
    await runAsync(`
      CREATE TABLE IF NOT EXISTS Ratings (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        meal_date  TEXT    NOT NULL,
        meal_type  TEXT    NOT NULL,
        stars      INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    // INSERT OR IGNORE means this is safe to run on every startup — it will
    // only insert rows that don't already exist (matched by UNIQUE name+role).
    // No need for a separate "migration" else-branch for the Warden account.
    console.log('🌱 Ensuring seed users exist…');
    const seedUsers = [
      { name: 'Navodit',         mobile_no: '9876543210', password: 'student123',    role: 'student',     hostel_name: 'Chitrakot' },
      { name: 'Rahul Sharma',    mobile_no: '9876543211', password: 'student456',    role: 'student',     hostel_name: 'Mainpat'   },
      { name: 'Priya Verma',     mobile_no: '9876543214', password: 'student789',    role: 'student',     hostel_name: 'Sirpur'    },
      { name: 'Mess Contractor', mobile_no: '9876543212', password: 'contractor123', role: 'contractor',  hostel_name: 'Chitrakot' },
      { name: 'Gate Guard',      mobile_no: '9876543213', password: 'guard123',      role: 'guard',       hostel_name: ''          },
      { name: 'Warden',          mobile_no: '9876543215', password: 'warden123',     role: 'warden',      hostel_name: ''          },
    ];
    for (const u of seedUsers) {
      // INSERT OR IGNORE skips the row if a user with the same name already exists
      await runAsync(
        'INSERT OR IGNORE INTO Users (name, mobile_no, password, role, hostel_name) VALUES (?, ?, ?, ?, ?)',
        [u.name, u.mobile_no, u.password, u.role, u.hostel_name]
      );
    }
    console.log('✅ Seed users ready. Credentials:');
    console.log('   Student:    Navodit / student123');
    console.log('   Contractor: Mess Contractor / contractor123');
    console.log('   Guard:      Gate Guard / guard123');
    console.log('   Warden:     Warden / warden123');

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

    // ── Inventory (Store Room) ─────────────────────────────────────────────
    // Tracks kitchen ingredients/supplies with quantity management.
    await runAsync(`
      CREATE TABLE IF NOT EXISTS Inventory (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        item_name   TEXT    NOT NULL,
        date_bought TEXT    NOT NULL,
        quantity    INTEGER NOT NULL DEFAULT 0
      )
    `);

    // ── Workers (Kitchen Staff) ────────────────────────────────────────────
    // Stores kitchen worker profiles. leave_until is NULL when not on leave.
    // If today < leave_until, the worker is automatically "On Leave".
    await runAsync(`
      CREATE TABLE IF NOT EXISTS Workers (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL,
        role       TEXT    NOT NULL DEFAULT 'Helper',
        leave_until TEXT   DEFAULT NULL
      )
    `);

    // ── Attendance (Daily worker attendance records) ───────────────────────
    // One row per worker per day. Status is 'Present', 'Absent', or 'On Leave'.
    await runAsync(`
      CREATE TABLE IF NOT EXISTS Attendance (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        worker_id INTEGER NOT NULL,
        date      TEXT    NOT NULL,
        status    TEXT    NOT NULL DEFAULT 'Present'
                          CHECK(status IN ('Present','Absent','On Leave')),
        UNIQUE(worker_id, date),
        FOREIGN KEY (worker_id) REFERENCES Workers(id)
      )
    `);

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
  if (!['student', 'contractor', 'guard', 'warden'].includes(role)) {
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
      `SELECT date, meal_type, cancelled, cancelled_at, reason
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
        reason:       row.reason || '',
      };
    }

    // Only include dates that have at least one record
    const history = dates
      .filter(d => mealMap[d])
      .map(d => ({
        date:  d,
        meals: {
          Breakfast: mealMap[d]['Breakfast'] || { cancelled: 0, cancelled_at: null, reason: '' },
          Lunch:     mealMap[d]['Lunch']     || { cancelled: 0, cancelled_at: null, reason: '' },
          Snacks:    mealMap[d]['Snacks']    || { cancelled: 0, cancelled_at: null, reason: '' },
          Dinner:    mealMap[d]['Dinner']    || { cancelled: 0, cancelled_at: null, reason: '' },
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
// POST /api/ratings — Anonymous post-meal star rating (1–5)
// Body: { meal_date, meal_type, stars }
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/ratings', async (req, res) => {
  const { meal_date, meal_type, stars } = req.body;
  if (!meal_date || !meal_type || !stars || stars < 1 || stars > 5) {
    return res.status(400).json({ success: false, error: 'meal_date, meal_type and valid stars (1-5) required.' });
  }
  try {
    await runAsync(
      'INSERT INTO Ratings (meal_date, meal_type, stars) VALUES (?, ?, ?)',
      [meal_date, meal_type, parseInt(stars, 10)]
    );
    res.json({ success: true, message: 'Rating submitted! Thank you.' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ratings?meal_date=YYYY-MM-DD&meal_type=Lunch
// Returns aggregated rating counts per star level (no student identities)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/ratings', async (req, res) => {
  const { meal_date, meal_type } = req.query;
  const today = getTodayIST();
  const date  = meal_date || today;
  const meal  = meal_type || 'Lunch';
  try {
    const breakdown = await allAsync(
      'SELECT stars, COUNT(*) AS count FROM Ratings WHERE meal_date = ? AND meal_type = ? GROUP BY stars ORDER BY stars DESC',
      [date, meal]
    );
    const totalRatings = breakdown.reduce((sum, b) => sum + b.count, 0);
    const avgStars = totalRatings > 0
      ? (breakdown.reduce((sum, b) => sum + b.stars * b.count, 0) / totalRatings).toFixed(1)
      : null;
    res.json({ success: true, meal_date: date, meal_type: meal, total: totalRatings, average: avgStars, breakdown });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ratings/all?meal_date=YYYY-MM-DD
// Returns ratings breakdown for all 4 meals on a given date
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/ratings/all', async (req, res) => {
  const { meal_date } = req.query;
  const today = getTodayIST();
  const date  = meal_date || today;
  try {
    const rows = await allAsync(
      'SELECT meal_type, stars, COUNT(*) AS count FROM Ratings WHERE meal_date = ? GROUP BY meal_type, stars',
      [date]
    );
    const result = {};
    for (const mealType of MEAL_TYPES) {
      const mealRows = rows.filter(r => r.meal_type === mealType);
      const breakdown = [5, 4, 3, 2, 1].map(s => {
        const found = mealRows.find(r => r.stars === s);
        return { stars: s, count: found ? found.count : 0 };
      });
      const total = breakdown.reduce((sum, b) => sum + b.count, 0);
      result[mealType] = {
        total_ratings: total,
        avg_stars: total > 0 ? (breakdown.reduce((sum, b) => sum + b.stars * b.count, 0) / total).toFixed(1) : null,
        breakdown,
      };
    }
    res.json({ success: true, meal_date: date, ratings: result });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
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
  const { student_id, date, meal_type, reason = '' } = req.body;
  if (!student_id || !date || !meal_type) return res.status(400).json({ success: false, error: 'student_id, date, and meal_type are required.' });
  if (!MEAL_TYPES.includes(meal_type)) return res.status(400).json({ success: false, error: `Invalid meal_type.` });

  try {
    const existing = await getAsync(
      'SELECT id, cancelled FROM Daily_Meals WHERE student_id = ? AND date = ? AND meal_type = ?',
      [student_id, date, meal_type]
    );
    if (!existing) {
      await runAsync(
        'INSERT INTO Daily_Meals (student_id, date, meal_type, cancelled, cancelled_at, reason, cancel_reason) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, ?, ?)',
        [student_id, date, meal_type, reason.trim(), reason.trim()]
      );
      return res.json({ success: true, action: 'cancelled', meal_type, message: `${meal_type} cancelled for ${date}.` });
    } else if (existing.cancelled === 1) {
      await runAsync(
        'UPDATE Daily_Meals SET cancelled = 0, cancelled_at = NULL, reason = NULL, cancel_reason = NULL WHERE student_id = ? AND date = ? AND meal_type = ?',
        [student_id, date, meal_type]
      );
      return res.json({ success: true, action: 'reinstated', meal_type, message: `${meal_type} reinstated for ${date}.` });
    } else {
      await runAsync(
        'UPDATE Daily_Meals SET cancelled = 1, cancelled_at = CURRENT_TIMESTAMP, reason = ?, cancel_reason = ? WHERE student_id = ? AND date = ? AND meal_type = ?',
        [reason.trim(), reason.trim(), student_id, date, meal_type]
      );
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
      SELECT dm.id, dm.student_id, s.name, s.roll_number, dm.meal_type, dm.cancelled_at, dm.date, dm.reason,
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
// PLATE FORMULA (Anti-Double-Count):
//   Plates = Total − Manual Cancellations − MAX(0, Guard Deliveries − "Ordered Online" Cancellations)
//
// WHY: A student who clicks "Ordered Online" AND whose delivery the guard logs
// is the SAME missed meal. If we blindly subtracted both, we'd under-cook by 1
// for every such student. We credit back any "Ordered Online" cancellations
// that overlap with guard deliveries so each absence is only counted once.
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
    // ── Step 1: Count manual app cancellations for THIS meal type today ───────
    const { count: mealCancellations } = await getAsync(
      'SELECT COUNT(*) as count FROM Daily_Meals WHERE date = ? AND meal_type = ? AND cancelled = 1',
      [today, meal_type]
    );

    // ── Step 2: Count total cancellations across ALL meals today ──────────────
    const { count: totalCancellations } = await getAsync(
      'SELECT COUNT(*) as count FROM Daily_Meals WHERE date = ? AND cancelled = 1', [today]
    );

    // ── Step 3: Count "Ordered Online" cancellations specifically ─────────────
    // These students flagged they're ordering from Swiggy/Zomato etc.
    // The guard will ALSO log a delivery for these same students, so we must
    // not double-subtract their absence from the plate count.
    const { count: onlineCancellations } = await getAsync(
      `SELECT COUNT(*) as count FROM Daily_Meals
       WHERE date = ? AND meal_type = ? AND cancelled = 1 AND (reason = 'Ordered online' OR cancel_reason = 'Ordered online')`,
      [today, meal_type]
    );

    // ── Step 4: Anti-double-count adjustment ──────────────────────────────────
    // Guard deliveries that are NOT already captured by "Ordered Online"
    // cancellations represent truly NEW absences we haven't subtracted yet.
    // MAX(0, ...) ensures we never add plates back if guard count < online count.
    const guardOnlyDeliveries = Math.max(0, liveCount - onlineCancellations);

    // ── Step 5: Potential attendees before AI correction ──────────────────────
    const potentialAttendees = TOTAL_ENROLLED - mealCancellations - guardOnlyDeliveries;

    // ── Step 6: AI / ML Prediction ────────────────────────────────────────────
    let mlPrediction = null, mlError = null;
    try {
      const mlResponse = await axios.post(
        `${ML_SERVICE_URL}/predict`,
        { weather, menu_item, delivery_traffic },
        { timeout: 5000 }
      );
      mlPrediction = mlResponse.data;
    } catch (mlErr) {
      mlError = `ML service unavailable: ${mlErr.message}`;
    }

    // ── Step 7: Scale ML prediction per meal type ─────────────────────────────
    // Lunch gets the full 500-student baseline; Breakfast gets 62% of that, etc.
    const scale                  = MEAL_SCALING[meal_type] || 1.0;
    const rawMLPrediction        = mlPrediction ? mlPrediction.predicted_attendance : potentialAttendees;
    const mealSpecificPrediction = Math.round(rawMLPrediction * scale);

    // ── Step 8: Unreported absences = people AI says won't come but didn't cancel
    const unreportedAbsences = Math.max(0, potentialAttendees - mealSpecificPrediction);

    // ── Step 9: Final plates recommendation ───────────────────────────────────
    const finalPlatesToCook = Math.max(0, potentialAttendees - unreportedAbsences);

    res.json({
      success: true, date: today, meal_type,
      total_enrolled: TOTAL_ENROLLED,
      manual_cancellations: mealCancellations,
      online_cancellations: onlineCancellations,      // students who said "Ordered online"
      guard_only_deliveries: guardOnlyDeliveries,     // NEW absences logged by guard
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
// INVENTORY (STORE ROOM) ENDPOINTS
// =============================================================================

// GET /api/inventory — list all inventory items
app.get('/api/inventory', async (req, res) => {
  try {
    const items = await allAsync('SELECT * FROM Inventory ORDER BY date_bought DESC, id DESC');
    res.json({ success: true, items });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/inventory — add a new inventory item
// Body: { item_name, date_bought, quantity }
app.post('/api/inventory', async (req, res) => {
  const { item_name, date_bought, quantity = 0 } = req.body;
  if (!item_name || !date_bought) {
    return res.status(400).json({ success: false, error: 'item_name and date_bought are required.' });
  }
  try {
    const result = await runAsync(
      'INSERT INTO Inventory (item_name, date_bought, quantity) VALUES (?, ?, ?)',
      [item_name.trim(), date_bought, parseInt(quantity, 10) || 0]
    );
    res.json({ success: true, id: result.lastID, message: `${item_name} added to inventory.` });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// PUT /api/inventory/:id — update quantity of an item
// Body: { quantity }
app.put('/api/inventory/:id', async (req, res) => {
  const id       = parseInt(req.params.id, 10);
  const quantity = parseInt(req.body.quantity, 10);
  if (isNaN(id) || isNaN(quantity) || quantity < 0) {
    return res.status(400).json({ success: false, error: 'Valid id and non-negative quantity required.' });
  }
  try {
    await runAsync('UPDATE Inventory SET quantity = ? WHERE id = ?', [quantity, id]);
    res.json({ success: true, id, quantity, message: 'Quantity updated.' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/inventory/:id — remove an inventory item
app.delete('/api/inventory/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    await runAsync('DELETE FROM Inventory WHERE id = ?', [id]);
    res.json({ success: true, message: 'Item removed.' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// =============================================================================
// WORKERS (KITCHEN STAFF) ENDPOINTS
// =============================================================================

// GET /api/workers — list all workers with today's attendance status
// Returns each worker's leave_until and computed on_leave flag
app.get('/api/workers', async (req, res) => {
  const today = getTodayIST();
  try {
    const workers = await allAsync(`
      SELECT w.id, w.name, w.role, w.leave_until,
        -- Check if the worker is on long leave (leave_until is in the future)
        CASE WHEN w.leave_until IS NOT NULL AND w.leave_until >= ? THEN 1 ELSE 0 END AS on_leave,
        -- Get today's attendance status if it exists
        a.status AS today_status
      FROM Workers w
      LEFT JOIN Attendance a ON a.worker_id = w.id AND a.date = ?
      ORDER BY w.id
    `, [today, today]);
    res.json({ success: true, workers, date: today });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/workers — add a new kitchen worker
// Body: { name, role }
app.post('/api/workers', async (req, res) => {
  const { name, role = 'Helper' } = req.body;
  if (!name) return res.status(400).json({ success: false, error: 'name is required.' });
  try {
    const result = await runAsync(
      'INSERT INTO Workers (name, role) VALUES (?, ?)',
      [name.trim(), role.trim()]
    );
    res.json({ success: true, id: result.lastID, name: name.trim(), role: role.trim() });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/workers/:id/attendance — mark daily attendance for a worker
// Body: { status } → 'Present' | 'Absent' | 'On Leave'
app.post('/api/workers/:id/attendance', async (req, res) => {
  const workerId = parseInt(req.params.id, 10);
  const { status } = req.body;
  const today = getTodayIST();
  if (!['Present', 'Absent', 'On Leave'].includes(status)) {
    return res.status(400).json({ success: false, error: 'status must be Present, Absent, or On Leave.' });
  }
  try {
    // INSERT OR REPLACE upserts: one record per (worker, day)
    await runAsync(
      'INSERT OR REPLACE INTO Attendance (worker_id, date, status) VALUES (?, ?, ?)',
      [workerId, today, status]
    );
    res.json({ success: true, worker_id: workerId, date: today, status });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// PUT /api/workers/:id/leave — set a long leave end date for a worker
// Body: { leave_until } → 'YYYY-MM-DD' or null to clear
app.put('/api/workers/:id/leave', async (req, res) => {
  const workerId   = parseInt(req.params.id, 10);
  const { leave_until } = req.body;
  const today = getTodayIST();
  try {
    await runAsync('UPDATE Workers SET leave_until = ? WHERE id = ?', [leave_until || null, workerId]);
    // If setting a leave, auto-mark today as On Leave in Attendance
    if (leave_until && leave_until >= today) {
      await runAsync(
        'INSERT OR REPLACE INTO Attendance (worker_id, date, status) VALUES (?, ?, ?)',
        [workerId, today, 'On Leave']
      );
    }
    res.json({ success: true, worker_id: workerId, leave_until: leave_until || null });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/attendance/summary?date=YYYY-MM-DD — attendance summary for a date
app.get('/api/attendance/summary', async (req, res) => {
  const date = req.query.date || getTodayIST();
  try {
    const rows = await allAsync(`
      SELECT w.id, w.name, w.role, w.leave_until, a.status
      FROM Workers w
      LEFT JOIN Attendance a ON a.worker_id = w.id AND a.date = ?
      ORDER BY w.id
    `, [date]);
    const summary = {
      total:    rows.length,
      present:  rows.filter(r => r.status === 'Present').length,
      absent:   rows.filter(r => r.status === 'Absent').length,
      on_leave: rows.filter(r => r.status === 'On Leave').length,
      unmarked: rows.filter(r => !r.status).length,
    };
    res.json({ success: true, date, workers: rows, summary });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});



// =============================================================================
// WARDEN STATS ENDPOINT
// =============================================================================

// GET /api/warden-stats
// Returns live KPIs for the Warden Dashboard:
//   • totalSpent     — SUM of all amounts in Purchases table
//   • avgRating      — average Ratings.stars across all time (rounded to 1dp)
//   • topSkipped     — top 3 meal+reason combos where reason = "Don't like this meal"
//   • receipts       — 10 most recent Purchases records (for the bills table)
app.get('/api/warden-stats', async (req, res) => {
  try {
    // ── Finance: sum all contractor purchase amounts ──────────────────────────
    const spendRow = await getAsync(
      'SELECT COALESCE(SUM(amount), 0) AS total FROM Purchases'
    );
    const totalSpent = Math.round(spendRow.total);

    // ── Satisfaction: average star rating across all meals, all dates ─────────
    const ratingRow = await getAsync(
      'SELECT ROUND(AVG(CAST(stars AS FLOAT)), 1) AS avg FROM Ratings'
    );
    const avgRating = ratingRow.avg ?? null;

    // ── Top Skipped: meal types most frequently cancelled with reason
    //    "Don't like this meal" — helps the warden flag bad menu items ─────────
    const topSkipped = await allAsync(`
      SELECT meal_type,
             COUNT(*) AS cancel_count
      FROM   Daily_Meals
      WHERE  cancelled = 1
        AND  (reason = 'Don''t like this meal' OR cancel_reason = 'Don''t like this meal')
      GROUP  BY meal_type
      ORDER  BY cancel_count DESC
      LIMIT  3
    `);

    // ── Receipts: 10 most recent purchases logged by the contractor ───────────
    const receipts = await allAsync(
      'SELECT * FROM Purchases ORDER BY date_bought DESC, id DESC LIMIT 10'
    );

    res.json({ success: true, totalSpent, avgRating, topSkipped, receipts });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// =============================================================================
// PURCHASES (CONTRACTOR BILLS) CRUD
// =============================================================================

// GET /api/purchases — list all purchase records
app.get('/api/purchases', async (req, res) => {
  try {
    const rows = await allAsync('SELECT * FROM Purchases ORDER BY date_bought DESC, id DESC');
    res.json({ success: true, purchases: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/purchases — add a new expense record
// Body: { description, amount, date_bought }
app.post('/api/purchases', async (req, res) => {
  const { description, amount, date_bought } = req.body;
  if (!description || amount === undefined || !date_bought) {
    return res.status(400).json({ success: false, error: 'description, amount, and date_bought are required.' });
  }
  try {
    const result = await runAsync(
      'INSERT INTO Purchases (description, amount, date_bought) VALUES (?, ?, ?)',
      [description.trim(), parseFloat(amount) || 0, date_bought]
    );
    res.json({ success: true, id: result.lastID, message: 'Purchase recorded.' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/purchases/:id — remove a purchase record
app.delete('/api/purchases/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    await runAsync('DELETE FROM Purchases WHERE id = ?', [id]);
    res.json({ success: true, message: 'Purchase deleted.' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// =============================================================================
// TELEGRAM BOT — /start HANDLER (links phone number → chat_id)
// =============================================================================
// When a user sends "/start 9876543210" in Telegram, we look up that mobile
// number in the Users table and store the Telegram chat_id so we can DM them.
if (bot) {
  bot.onText(/\/start(?:\s+(\d+))?/, async (msg, match) => {
    const chatId = String(msg.chat.id);
    const phone  = match[1]; // the phone number they sent after /start

    if (!phone) {
      bot.sendMessage(chatId,
        '👋 *Welcome to MessMind Bot!*\n\n' +
        'To link your account, send:\n`/start <your 10-digit mobile number>`\n\n' +
        '_Example: `/start 9876543210`_',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    try {
      // Look up the user by mobile number (any role)
      const user = await getAsync(
        'SELECT id, name, role FROM Users WHERE mobile_no = ?',
        [phone.trim()]
      );

      if (!user) {
        bot.sendMessage(chatId,
          '❌ No account found for that mobile number.\n' +
          'Please sign up at the MessMind web app first.'
        );
        return;
      }

      // Persist the chat_id so we can DM this user later
      await runAsync(
        'UPDATE Users SET telegram_chat_id = ? WHERE mobile_no = ?',
        [chatId, phone.trim()]
      );

      bot.sendMessage(chatId,
        `✅ *Linked successfully!*\n\n` +
        `Hello, *${user.name}* 👋\n` +
        `Role: ${user.role}\n\n` +
        `You will now receive meal notifications here.\n` +
        `Stay tuned for today's lunch alert! 🍲`,
        { parse_mode: 'Markdown' }
      );
      console.log(`🔗 Telegram linked: ${user.name} (${user.role}) → chat_id ${chatId}`);
    } catch (e) {
      bot.sendMessage(chatId, '⚠️ An internal error occurred. Please try again later.');
      console.error('Telegram /start error:', e.message);
    }
  });

  // ── Inline keyboard callback_query handler ──────────────────────────────────
  // Handles the "No" → reason picker flow from the lunch notification message.
  // Callback data format:
  //   "lunch_yes:<student_id>"              → user confirmed they're eating
  //   "lunch_no:<student_id>"               → user wants to cancel; show reason buttons
  //   "reason:<student_id>:<reason_text>"   → user picked a reason; write cancellation to DB
  bot.on('callback_query', async (query) => {
    const chatId = String(query.message.chat.id);
    const data   = query.data || '';

    // Acknowledge the button tap immediately (removes spinner on mobile)
    bot.answerCallbackQuery(query.id);

    // ── "Yes, I'm eating" ──────────────────────────────────────────────────
    if (data.startsWith('lunch_yes:')) {
      bot.sendMessage(chatId, '✅ Enjoy your lunch! See you at the mess. 🍽️');
      return;
    }

    // ── "No, cancel my meal" — show reason buttons ──────────────────────────
    if (data.startsWith('lunch_no:')) {
      const studentId = data.split(':')[1];
      bot.sendMessage(chatId,
        '❓ *Why are you skipping?*\nYour reason helps us improve the menu.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🛵 Ordered online',        callback_data: `reason:${studentId}:Ordered online` }],
              [{ text: '😕 Don\'t like this meal', callback_data: `reason:${studentId}:Don't like this meal` }],
              [{ text: '💬 Other reasons',          callback_data: `reason:${studentId}:Other reasons` }],
            ],
          },
        }
      );
      return;
    }

    // ── User picked a reason → write cancellation to Daily_Meals ──────────────
    if (data.startsWith('reason:')) {
      const parts     = data.split(':');
      const studentId = parseInt(parts[1], 10);
      const reason    = parts.slice(2).join(':'); // rejoin in case reason contained ':'
      const today     = getTodayIST();
      const mealType  = 'Lunch'; // This flow is for the lunch notification

      try {
        // Upsert — mirrors exactly what the web app's /cancel-meal endpoint does
        const existing = await getAsync(
          'SELECT id, cancelled FROM Daily_Meals WHERE student_id = ? AND date = ? AND meal_type = ?',
          [studentId, today, mealType]
        );

        if (!existing) {
          await runAsync(
            'INSERT INTO Daily_Meals (student_id, date, meal_type, cancelled, cancelled_at, reason, cancel_reason) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, ?, ?)',
            [studentId, today, mealType, reason, reason]
          );
        } else if (existing.cancelled !== 1) {
          await runAsync(
            'UPDATE Daily_Meals SET cancelled = 1, cancelled_at = CURRENT_TIMESTAMP, reason = ?, cancel_reason = ? WHERE student_id = ? AND date = ? AND meal_type = ?',
            [reason, reason, studentId, today, mealType]
          );
        }

        bot.sendMessage(chatId,
          `✅ *Lunch cancelled!*\n\n` +
          `Reason: _${reason}_\n\n` +
          `Your plate has been freed up. The kitchen will cook less today. 🌱`,
          { parse_mode: 'Markdown' }
        );
        console.log(`📲 Telegram cancellation: student_id=${studentId} reason="${reason}"`);
      } catch (e) {
        bot.sendMessage(chatId, '⚠️ Could not save your cancellation. Please try again.');
        console.error('Telegram reason callback error:', e.message);
      }
    }
  });
}

// =============================================================================
// TELEGRAM TRIGGER ENDPOINT (for live hackathon demo)
// =============================================================================
// GET /api/trigger-bot-lunch
// Fetches today's lunch menu from the DB and sends a notification to all
// users who have linked their Telegram account. Includes Yes/No inline buttons.
// During the demo: the judge can call this URL to trigger a live notification.
app.get('/api/trigger-bot-lunch', async (req, res) => {
  if (!bot) {
    return res.status(503).json({ success: false, error: 'Telegram bot is not configured.' });
  }

  try {
    const today   = getTodayIST();
    const dayName = getDayName(today); // e.g. 'Sunday'

    // Fetch today's lunch items from the Weekly_Menu table
    const menuRow = await getAsync(
      'SELECT items FROM Weekly_Menu WHERE day_of_week = ? AND meal_type = ?',
      [dayName, 'Lunch']
    );
    const menuText = menuRow?.items || 'Menu not set for today';

    // Get all users who have a telegram_chat_id linked
    const linkedUsers = await allAsync(
      `SELECT u.id, u.name, u.mobile_no, u.telegram_chat_id,
              s.id AS student_id
       FROM   Users u
       LEFT JOIN Students s ON LOWER(s.name) = LOWER(u.name)
       WHERE  u.telegram_chat_id IS NOT NULL
         AND  u.role = 'student'`
    );

    if (linkedUsers.length === 0) {
      return res.json({ success: true, sent: 0, message: 'No linked users found.' });
    }

    let sent = 0;
    for (const user of linkedUsers) {
      const studentId = user.student_id;
      if (!studentId) continue; // skip if no matching Students row

      const message =
        `🍲 *Today's Lunch — ${today}*\n\n` +
        `📋 ${menuText}\n\n` +
        `*Are you eating at the mess today?*`;

      try {
        await bot.sendMessage(user.telegram_chat_id, message, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Yes, I\'m eating!', callback_data: `lunch_yes:${studentId}` },
              { text: '❌ No, cancel meal',   callback_data: `lunch_no:${studentId}`  },
            ]],
          },
        });
        sent++;
      } catch (err) {
        // One user's failure shouldn't stop the rest (e.g. they blocked the bot)
        console.warn(`⚠️ Could not send to ${user.name} (${user.telegram_chat_id}):`, err.message);
      }
    }

    res.json({ success: true, sent, total_linked: linkedUsers.length, menu: menuText, date: today });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// =============================================================================
// START SERVER
// =============================================================================
server.listen(PORT, () => {
  console.log('\n' + '='.repeat(62));
  console.log('🚀  Mess Forecasting Backend v5 (Warden + Telegram) is LIVE!');
  console.log(`📡  HTTP  → http://localhost:${PORT}`);
  console.log(`🔌  WS    → ws://localhost:${PORT}`);
  console.log(`🤖  ML    → ${ML_SERVICE_URL}`);
  console.log(`📲  Bot   → ${bot ? 'Telegram polling active' : 'Disabled (no token)'}`);
  console.log('='.repeat(62) + '\n');
});
