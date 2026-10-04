// =============================================================================
// FILE: server.js  —  Node.js / Express + Socket.io Backend  (v7)
// =============================================================================
// NEW IN v7:
//   • Purchases table + CRUD (bill tracking with base64 images)
//   • Waste_Logs table + CRUD (food waste tracking per meal)
//   • GET /api/warden-stats — aggregated analytics for the Warden portal
// =============================================================================

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const sqlite3    = require('sqlite3').verbose();
const cors       = require('cors');
const path       = require('path');

const PORT           = 3001;
const TOTAL_ENROLLED = 500;
const MEAL_TYPES     = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];
const DAYS_OF_WEEK   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOSTELS        = ['Chitrakot', 'Mainpat', 'Sirpur', 'Mahanadi', 'Indravati', 'Malhar', 'Kotumsar', 'Seonath'];

const hostelCounts = HOSTELS.reduce((acc, h) => ({ ...acc, [h]: 0 }), {});

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: 'http://localhost:3000', methods: ['GET', 'POST'] } });

app.use(cors({ origin: 'http://localhost:3000', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(express.json({ limit: '20mb' })); // allow large base64 images

const DB_PATH = path.join(__dirname, 'mess.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) { console.error('❌ DB open failed:', err.message); process.exit(1); }
  console.log(`✅ SQLite connected: ${DB_PATH}`);
});
db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA foreign_keys = ON');

const runAsync = (sql, p = []) => new Promise((res, rej) =>
  db.run(sql, p, function(e) { e ? rej(e) : res(this); })
);
const getAsync = (sql, p = []) => new Promise((res, rej) =>
  db.get(sql, p, (e, row) => e ? rej(e) : res(row))
);
const allAsync = (sql, p = []) => new Promise((res, rej) =>
  db.all(sql, p, (e, rows) => e ? rej(e) : res(rows))
);

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

// =============================================================================
// DATABASE INITIALISATION
// =============================================================================
(async () => {
  try {
    await runAsync(`CREATE TABLE IF NOT EXISTS Students (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      roll_number TEXT    UNIQUE NOT NULL
    )`);

    await runAsync(`CREATE TABLE IF NOT EXISTS Users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      mobile_no   TEXT    NOT NULL,
      password    TEXT    NOT NULL,
      role        TEXT    NOT NULL CHECK(role IN ('student','contractor','guard','warden')),
      hostel_name TEXT    NOT NULL DEFAULT ''
    )`);

    try { await runAsync(`ALTER TABLE Users ADD COLUMN hostel_name TEXT NOT NULL DEFAULT ''`); } catch {}

    const colCheck    = await allAsync(`PRAGMA table_info(Daily_Meals)`);
    const hasMealType = colCheck.some(c => c.name === 'meal_type');
    if (!hasMealType && colCheck.length > 0) await runAsync(`DROP TABLE IF EXISTS Daily_Meals`);

    await runAsync(`CREATE TABLE IF NOT EXISTS Daily_Meals (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id   INTEGER NOT NULL,
      date         TEXT    NOT NULL,
      meal_type    TEXT    NOT NULL DEFAULT 'Lunch',
      cancelled    INTEGER DEFAULT 0,
      cancelled_at DATETIME,
      reason       TEXT    DEFAULT '',
      UNIQUE(student_id, date, meal_type),
      FOREIGN KEY (student_id) REFERENCES Students(id)
    )`);

    try { await runAsync(`ALTER TABLE Daily_Meals ADD COLUMN reason TEXT DEFAULT ''`); } catch {}

    await runAsync(`CREATE TABLE IF NOT EXISTS Weekly_Menu (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week TEXT    NOT NULL,
      meal_type   TEXT    NOT NULL,
      items       TEXT    NOT NULL DEFAULT '',
      UNIQUE(day_of_week, meal_type)
    )`);

    await runAsync(`CREATE TABLE IF NOT EXISTS Leaves (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      start_date TEXT    NOT NULL,
      end_date   TEXT    NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES Students(id)
    )`);

    await runAsync(`CREATE TABLE IF NOT EXISTS Hostel_Deliveries (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      date   TEXT    NOT NULL,
      hostel TEXT    NOT NULL,
      count  INTEGER NOT NULL DEFAULT 0,
      UNIQUE(date, hostel)
    )`);

    await runAsync(`CREATE TABLE IF NOT EXISTS Delivery_Logs (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      hostel               TEXT    NOT NULL,
      delivery_person_name TEXT    NOT NULL,
      mobile_no            TEXT    NOT NULL,
      in_time              TEXT    NOT NULL,
      date                 TEXT    NOT NULL
    )`);

    await runAsync(`CREATE TABLE IF NOT EXISTS Ratings (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_date TEXT    NOT NULL,
      meal_type TEXT    NOT NULL,
      stars     INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5),
      rated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await runAsync(`CREATE TABLE IF NOT EXISTS Inventory (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name   TEXT    NOT NULL,
      date_bought TEXT    NOT NULL,
      quantity    INTEGER NOT NULL DEFAULT 0,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await runAsync(`CREATE TABLE IF NOT EXISTS Workers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      role        TEXT    NOT NULL DEFAULT 'Cook',
      leave_until TEXT    DEFAULT NULL,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await runAsync(`CREATE TABLE IF NOT EXISTS Attendance (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL,
      date      TEXT    NOT NULL,
      status    TEXT    NOT NULL CHECK(status IN ('Present','Absent','On Leave')),
      UNIQUE(worker_id, date),
      FOREIGN KEY (worker_id) REFERENCES Workers(id)
    )`);

    // ── NEW v7: Purchases (financial tracking with base64 receipt image) ──
    await runAsync(`CREATE TABLE IF NOT EXISTS Purchases (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      date          TEXT    NOT NULL,
      amount        REAL    NOT NULL,
      description   TEXT    NOT NULL DEFAULT '',
      receipt_image TEXT    DEFAULT NULL,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // ── NEW v7: Waste_Logs (food waste per meal) ───────────────────────────
    await runAsync(`CREATE TABLE IF NOT EXISTS Waste_Logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      date       TEXT    NOT NULL,
      meal_type  TEXT    NOT NULL,
      weight_kg  REAL    NOT NULL,
      notes      TEXT    DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

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

    const { count: uc } = await getAsync('SELECT COUNT(*) as count FROM Users');
    if (uc === 0) {
      const mockUsers = [
        { name: 'Navodit',         mobile_no: '9876543210', password: 'student123',    role: 'student',    hostel_name: 'Chitrakot' },
        { name: 'Rahul Sharma',    mobile_no: '9876543211', password: 'student456',    role: 'student',    hostel_name: 'Mainpat'   },
        { name: 'Priya Verma',     mobile_no: '9876543214', password: 'student789',    role: 'student',    hostel_name: 'Sirpur'    },
        { name: 'Mess Contractor', mobile_no: '9876543212', password: 'contractor123', role: 'contractor', hostel_name: 'Chitrakot' },
        { name: 'Gate Guard',      mobile_no: '9876543213', password: 'guard123',      role: 'guard',      hostel_name: ''          },
        { name: 'admin',           mobile_no: '9999999999', password: 'admin123',      role: 'warden',     hostel_name: ''          },
      ];
      await runAsync('BEGIN TRANSACTION');
      for (const u of mockUsers) {
        await runAsync(
          'INSERT INTO Users (name, mobile_no, password, role, hostel_name) VALUES (?, ?, ?, ?, ?)',
          [u.name, u.mobile_no, u.password, u.role, u.hostel_name]
        );
      }
      await runAsync('COMMIT');
      console.log('✅ Mock users seeded (incl. warden: admin/admin123)!');
    } else {
      // Ensure warden user exists even after upgrade
      const warden = await getAsync("SELECT id FROM Users WHERE role='warden' LIMIT 1");
      if (!warden) {
        await runAsync(
          "INSERT OR IGNORE INTO Users (name, mobile_no, password, role, hostel_name) VALUES ('admin','9999999999','admin123','warden','')"
        );
        console.log('🔄 Warden account added.');
      }
    }

    const studentUsers = await allAsync("SELECT name FROM Users WHERE role = 'student'");
    for (const u of studentUsers) {
      const existing = await getAsync('SELECT id FROM Students WHERE LOWER(name) = LOWER(?)', [u.name]);
      if (!existing) {
        const roll = 'U' + u.name.replace(/\s+/g, '').toUpperCase().substring(0, 8);
        await runAsync('INSERT OR IGNORE INTO Students (name, roll_number) VALUES (?, ?)', [u.name, roll]);
      }
    }

    const { count: mc } = await getAsync('SELECT COUNT(*) as count FROM Weekly_Menu');
    if (mc === 0) {
      const defaultMenu = {
        Monday:    { Breakfast: 'Idli, Sambar, Coconut Chutney, Banana',   Lunch: 'Dal Tadka, Jeera Rice, Phulka, Mixed Veg', Snacks: 'Bread Pakora, Masala Chai',    Dinner: 'Paneer Butter Masala, Butter Naan, Rice, Raita' },
        Tuesday:   { Breakfast: 'Poha, Boiled Eggs, Tea, Fruit',           Lunch: 'Rajma Chawal, Roti, Boondi Raita, Pickle', Snacks: 'Vada Pav, Ginger Tea',         Dinner: 'Dal Makhani, Tawa Roti, Jeera Rice, Papad'     },
        Wednesday: { Breakfast: 'Upma, Peanut Chutney, Coffee, Orange',    Lunch: 'Chhole, Bhature, Onion Salad, Lassi',      Snacks: 'Dhokla, Tamarind Chutney, Tea', Dinner: 'Mix Veg Curry, Chapati, Rice, Curd'             },
        Thursday:  { Breakfast: 'Puri Bhaji, Pickle, Tea',                 Lunch: 'Kadhi Pakora, Rice, Phulka, Papad',        Snacks: 'Aloo Tikki, Mint Chutney, Tea', Dinner: 'Butter Paneer, Naan, Rice, Gulab Jamun'         },
        Friday:    { Breakfast: 'Dosa, Coconut Chutney, Sambar, Coffee',   Lunch: 'Pulao, Raita, Soya Curry, Roti',           Snacks: 'Matar Kulcha, Chai',            Dinner: 'Dal Fry, Jeera Rice, Roti, Halwa'               },
        Saturday:  { Breakfast: 'Aloo Paratha, Butter, Curd, Tea',         Lunch: 'Biryani, Mirchi ka Salan, Raita, Papad',   Snacks: 'Samosa, Chaat, Cold Drink',     Dinner: 'Paneer Kofta, Chapati, Rice, Ice Cream'         },
        Sunday:    { Breakfast: 'Bread Omelette, Cornflakes, Milk, Juice', Lunch: 'Chole Bhature, Raita, Salad, Lassi',       Snacks: 'Popcorn, Juice, Biscuits',      Dinner: 'Dal Makhani, Shahi Paneer, Naan, Rice, Kheer'   },
      };
      await runAsync('BEGIN TRANSACTION');
      for (const [day, meals] of Object.entries(defaultMenu)) {
        for (const [mealType, items] of Object.entries(meals)) {
          await runAsync('INSERT OR IGNORE INTO Weekly_Menu (day_of_week, meal_type, items) VALUES (?, ?, ?)', [day, mealType, items]);
        }
      }
      await runAsync('COMMIT');
    }

    const today = getTodayIST();
    const existingCounts = await allAsync('SELECT hostel, count FROM Hostel_Deliveries WHERE date = ?', [today]);
    for (const row of existingCounts) {
      if (hostelCounts.hasOwnProperty(row.hostel)) hostelCounts[row.hostel] = row.count;
    }
    console.log("✅ Today's hostel delivery counts loaded:", hostelCounts);
    console.log('✅ All DB tables ready (v7 — Purchases, Waste_Logs added).');

  } catch (err) { console.error('❌ DB init failed:', err); }
})();

// =============================================================================
// SOCKET.IO
// =============================================================================
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  socket.emit('delivery_count_updated', hostelCounts);

  socket.on('log_delivery', async ({ hostel }) => {
    if (!HOSTELS.includes(hostel)) { socket.emit('error', { message: `Unknown hostel: ${hostel}` }); return; }
    hostelCounts[hostel] += 1;
    const today = getTodayIST();
    io.emit('delivery_count_updated', { ...hostelCounts });
    try {
      await runAsync(`INSERT INTO Hostel_Deliveries (date, hostel, count) VALUES (?, ?, ?)
        ON CONFLICT(date, hostel) DO UPDATE SET count = excluded.count`,
        [today, hostel, hostelCounts[hostel]]);
    } catch (err) { console.error(`❌ delivery persist failed:`, err.message); }
  });

  socket.on('disconnect', () => console.log(`🔌 Client disconnected: ${socket.id}`));
});

// =============================================================================
// AUTH
// =============================================================================
app.post('/api/signup', async (req, res) => {
  const { name, mobile_no, password, role, hostel_name = '' } = req.body;
  if (!name || !mobile_no || !password || !role)
    return res.status(400).json({ success: false, error: 'All fields are required.' });
  if (!['student', 'contractor', 'guard', 'warden'].includes(role))
    return res.status(400).json({ success: false, error: 'Invalid role.' });
  if (password.length < 6)
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
  if ((role === 'student' || role === 'contractor') && !hostel_name)
    return res.status(400).json({ success: false, error: 'Please select a hostel.' });
  try {
    const result = await runAsync(
      'INSERT INTO Users (name, mobile_no, password, role, hostel_name) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), mobile_no.trim(), password, role, hostel_name.trim()]
    );
    if (role === 'student') {
      const roll = 'U' + name.trim().replace(/\s+/g, '').toUpperCase().substring(0, 8);
      await runAsync('INSERT OR IGNORE INTO Students (name, roll_number) VALUES (?, ?)', [name.trim(), roll]);
    }
    res.json({ success: true, message: 'Account created!', user: { id: result.lastID, name: name.trim(), role, hostel_name: hostel_name.trim() } });
  } catch (e) {
    if (e.message?.includes('UNIQUE'))
      return res.status(409).json({ success: false, error: 'An account with this name already exists.' });
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { name, password, role } = req.body;
  if (!name || !password || !role)
    return res.status(400).json({ success: false, error: 'Name, password and role are required.' });
  try {
    const user = await getAsync(
      'SELECT id, name, role, hostel_name FROM Users WHERE LOWER(name) = LOWER(?) AND password = ? AND role = ?',
      [name.trim(), password, role]
    );
    if (!user)
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    res.json({ success: true, user: { id: user.id, name: user.name, role: user.role, hostel_name: user.hostel_name || '' } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

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
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// =============================================================================
// MEAL HISTORY / LEADERBOARD
// =============================================================================
app.get('/api/meal-history/:student_id', async (req, res) => {
  const studentId = parseInt(req.params.student_id, 10);
  const days      = Math.min(parseInt(req.query.days || '14', 10), 90);
  if (!studentId) return res.status(400).json({ success: false, error: 'Invalid student_id.' });
  try {
    const today  = getTodayIST();
    const dates  = [];
    const cursor = new Date(today + 'T00:00:00+05:30');
    for (let i = 0; i < days; i++) {
      dates.push(cursor.toISOString().split('T')[0]);
      cursor.setDate(cursor.getDate() - 1);
    }
    const earliest = dates[dates.length - 1];
    const rows = await allAsync(
      `SELECT date, meal_type, cancelled, cancelled_at, reason FROM Daily_Meals
       WHERE student_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC, meal_type`,
      [studentId, earliest, today]
    );
    const mealMap = {};
    for (const row of rows) {
      if (!mealMap[row.date]) mealMap[row.date] = {};
      mealMap[row.date][row.meal_type] = { cancelled: row.cancelled, cancelled_at: row.cancelled_at, reason: row.reason || '' };
    }
    const history = dates.filter(d => mealMap[d]).map(d => ({
      date: d,
      meals: {
        Breakfast: mealMap[d]['Breakfast'] || { cancelled: 0, cancelled_at: null, reason: '' },
        Lunch:     mealMap[d]['Lunch']     || { cancelled: 0, cancelled_at: null, reason: '' },
        Snacks:    mealMap[d]['Snacks']    || { cancelled: 0, cancelled_at: null, reason: '' },
        Dinner:    mealMap[d]['Dinner']    || { cancelled: 0, cancelled_at: null, reason: '' },
      }
    }));
    res.json({ success: true, student_id: studentId, days, history });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/leaderboard', async (req, res) => {
  const month = getTodayIST().substring(0, 7);
  try {
    const rows = await allAsync(`
      SELECT s.name, COUNT(*) AS cancellations FROM Daily_Meals dm
      JOIN Students s ON s.id = dm.student_id
      WHERE dm.cancelled = 1 AND dm.date LIKE ?
      GROUP BY dm.student_id, s.name ORDER BY cancellations DESC LIMIT 15
    `, [`${month}%`]);
    res.json({ success: true, month, leaderboard: rows.map(r => ({ name: r.name, cancellations: r.cancellations, points: r.cancellations * 10 })) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// =============================================================================
// DELIVERY LOGS
// =============================================================================
app.post('/api/delivery-logs', async (req, res) => {
  const { hostel, delivery_person_name, mobile_no, in_time } = req.body;
  if (!hostel || !delivery_person_name || !mobile_no || !in_time)
    return res.status(400).json({ success: false, error: 'hostel, delivery_person_name, mobile_no, in_time are required.' });
  if (!HOSTELS.includes(hostel))
    return res.status(400).json({ success: false, error: `Unknown hostel: ${hostel}` });
  const today = getTodayIST();
  try {
    const result = await runAsync(
      'INSERT INTO Delivery_Logs (hostel, delivery_person_name, mobile_no, in_time, date) VALUES (?, ?, ?, ?, ?)',
      [hostel, delivery_person_name.trim(), mobile_no.trim(), in_time, today]
    );
    hostelCounts[hostel] = (hostelCounts[hostel] || 0) + 1;
    io.emit('delivery_count_updated', { ...hostelCounts });
    try {
      await runAsync(`INSERT INTO Hostel_Deliveries (date, hostel, count) VALUES (?, ?, ?)
        ON CONFLICT(date, hostel) DO UPDATE SET count = excluded.count`,
        [today, hostel, hostelCounts[hostel]]);
    } catch (_) {}
    res.json({ success: true, message: 'Delivery log saved!', id: result.lastID });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/delivery-logs', async (req, res) => {
  const date = req.query.date || getTodayIST();
  try {
    const logs = await allAsync(
      'SELECT id, hostel, delivery_person_name, mobile_no, in_time, date FROM Delivery_Logs WHERE date = ? ORDER BY id DESC',
      [date]
    );
    res.json({ success: true, date, logs });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// =============================================================================
// RATINGS
// =============================================================================
app.post('/api/ratings', async (req, res) => {
  const { meal_date, meal_type, stars } = req.body;
  if (!meal_date || !meal_type || !stars)
    return res.status(400).json({ success: false, error: 'meal_date, meal_type, and stars are required.' });
  if (!MEAL_TYPES.includes(meal_type))
    return res.status(400).json({ success: false, error: 'Invalid meal_type.' });
  const starsInt = parseInt(stars, 10);
  if (isNaN(starsInt) || starsInt < 1 || starsInt > 5)
    return res.status(400).json({ success: false, error: 'stars must be between 1 and 5.' });
  try {
    await runAsync('INSERT INTO Ratings (meal_date, meal_type, stars) VALUES (?, ?, ?)', [meal_date, meal_type, starsInt]);
    res.json({ success: true, message: 'Rating submitted!' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/ratings/all', async (req, res) => {
  const { meal_date } = req.query;
  if (!meal_date) return res.status(400).json({ success: false, error: 'meal_date is required.' });
  try {
    const rows = await allAsync(
      'SELECT meal_type, stars, COUNT(*) AS count FROM Ratings WHERE meal_date = ? GROUP BY meal_type, stars',
      [meal_date]
    );
    const result = {};
    for (const mealType of MEAL_TYPES) {
      const mealRows  = rows.filter(r => r.meal_type === mealType);
      const breakdown = [5,4,3,2,1].map(s => { const f = mealRows.find(r => r.stars === s); return { stars: s, count: f ? f.count : 0 }; });
      const total     = breakdown.reduce((sum, b) => sum + b.count, 0);
      result[mealType] = {
        total_ratings: total,
        avg_stars: total > 0 ? (breakdown.reduce((sum, b) => sum + b.stars * b.count, 0) / total).toFixed(1) : null,
        breakdown,
      };
    }
    res.json({ success: true, meal_date, ratings: result });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// =============================================================================
// INVENTORY
// =============================================================================
app.get('/api/inventory', async (req, res) => {
  try { res.json({ success: true, items: await allAsync('SELECT * FROM Inventory ORDER BY created_at DESC') }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/inventory', async (req, res) => {
  const { item_name, date_bought, quantity } = req.body;
  if (!item_name || !date_bought || quantity === undefined)
    return res.status(400).json({ success: false, error: 'item_name, date_bought, and quantity are required.' });
  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty < 0) return res.status(400).json({ success: false, error: 'quantity must be a non-negative integer.' });
  try {
    const result = await runAsync('INSERT INTO Inventory (item_name, date_bought, quantity) VALUES (?, ?, ?)', [item_name.trim(), date_bought, qty]);
    res.json({ success: true, item: await getAsync('SELECT * FROM Inventory WHERE id = ?', [result.lastID]) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.put('/api/inventory/:id', async (req, res) => {
  const qty = parseInt(req.body.quantity, 10);
  if (isNaN(qty) || qty < 0) return res.status(400).json({ success: false, error: 'quantity must be >= 0.' });
  try {
    await runAsync('UPDATE Inventory SET quantity = ? WHERE id = ?', [qty, req.params.id]);
    const item = await getAsync('SELECT * FROM Inventory WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ success: false, error: 'Item not found.' });
    res.json({ success: true, item });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.delete('/api/inventory/:id', async (req, res) => {
  try { await runAsync('DELETE FROM Inventory WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// =============================================================================
// WORKERS & ATTENDANCE
// =============================================================================
app.get('/api/workers', async (req, res) => {
  const today = getTodayIST();
  try {
    const workers        = await allAsync('SELECT * FROM Workers ORDER BY created_at ASC');
    const attendanceRows = await allAsync('SELECT worker_id, status FROM Attendance WHERE date = ?', [today]);
    const attendanceMap  = {};
    for (const row of attendanceRows) attendanceMap[row.worker_id] = row.status;
    const enriched = workers.map(w => {
      const onLeave = w.leave_until && today <= w.leave_until;
      return { ...w, today_status: onLeave ? 'On Leave' : (attendanceMap[w.id] || null), on_leave: !!onLeave };
    });
    res.json({ success: true, workers: enriched });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/workers', async (req, res) => {
  const { name, role = 'Cook' } = req.body;
  if (!name) return res.status(400).json({ success: false, error: 'name is required.' });
  try {
    const result = await runAsync('INSERT INTO Workers (name, role) VALUES (?, ?)', [name.trim(), role.trim()]);
    res.json({ success: true, worker: await getAsync('SELECT * FROM Workers WHERE id = ?', [result.lastID]) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/workers/:id/attendance', async (req, res) => {
  const { status } = req.body;
  if (!['Present','Absent','On Leave'].includes(status))
    return res.status(400).json({ success: false, error: 'Invalid status.' });
  const today = getTodayIST();
  try {
    await runAsync(`INSERT INTO Attendance (worker_id, date, status) VALUES (?, ?, ?)
      ON CONFLICT(worker_id, date) DO UPDATE SET status = excluded.status`, [req.params.id, today, status]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.put('/api/workers/:id/leave', async (req, res) => {
  const { leave_until } = req.body;
  try {
    await runAsync('UPDATE Workers SET leave_until = ? WHERE id = ?', [leave_until || null, req.params.id]);
    if (leave_until) {
      const dates = getDatesInRange(getTodayIST(), leave_until);
      for (const date of dates) {
        await runAsync(`INSERT INTO Attendance (worker_id, date, status) VALUES (?, ?, 'On Leave')
          ON CONFLICT(worker_id, date) DO UPDATE SET status = 'On Leave'`, [req.params.id, date]);
      }
    }
    res.json({ success: true, worker: await getAsync('SELECT * FROM Workers WHERE id = ?', [req.params.id]) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.delete('/api/workers/:id', async (req, res) => {
  try {
    await runAsync('DELETE FROM Attendance WHERE worker_id = ?', [req.params.id]);
    await runAsync('DELETE FROM Workers WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// =============================================================================
// PURCHASES (Financial Tracking)
// =============================================================================
app.get('/api/purchases', async (req, res) => {
  try {
    const purchases = await allAsync('SELECT id, date, amount, description, receipt_image, created_at FROM Purchases ORDER BY created_at DESC');
    res.json({ success: true, purchases });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/purchases', async (req, res) => {
  const { date, amount, description = '', receipt_image = null } = req.body;
  if (!date || amount === undefined)
    return res.status(400).json({ success: false, error: 'date and amount are required.' });
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt < 0)
    return res.status(400).json({ success: false, error: 'amount must be a non-negative number.' });
  try {
    const result = await runAsync(
      'INSERT INTO Purchases (date, amount, description, receipt_image) VALUES (?, ?, ?, ?)',
      [date, amt, description.trim(), receipt_image || null]
    );
    const purchase = await getAsync('SELECT id, date, amount, description, receipt_image, created_at FROM Purchases WHERE id = ?', [result.lastID]);
    res.json({ success: true, message: 'Purchase recorded!', purchase });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.delete('/api/purchases/:id', async (req, res) => {
  try {
    await runAsync('DELETE FROM Purchases WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Purchase deleted.' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// =============================================================================
// WASTE LOGS
// =============================================================================
app.get('/api/waste-logs', async (req, res) => {
  const { date } = req.query;
  try {
    const query = date
      ? 'SELECT * FROM Waste_Logs WHERE date = ? ORDER BY created_at DESC'
      : 'SELECT * FROM Waste_Logs ORDER BY date DESC, created_at DESC LIMIT 50';
    const logs = date ? await allAsync(query, [date]) : await allAsync(query);
    res.json({ success: true, logs });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/waste-logs', async (req, res) => {
  const { date, meal_type, weight_kg, notes = '' } = req.body;
  if (!date || !meal_type || weight_kg === undefined)
    return res.status(400).json({ success: false, error: 'date, meal_type, and weight_kg are required.' });
  if (!MEAL_TYPES.includes(meal_type))
    return res.status(400).json({ success: false, error: 'Invalid meal_type.' });
  const weight = parseFloat(weight_kg);
  if (isNaN(weight) || weight < 0)
    return res.status(400).json({ success: false, error: 'weight_kg must be a non-negative number.' });
  try {
    const result = await runAsync(
      'INSERT INTO Waste_Logs (date, meal_type, weight_kg, notes) VALUES (?, ?, ?, ?)',
      [date, meal_type, weight, notes.trim()]
    );
    const log = await getAsync('SELECT * FROM Waste_Logs WHERE id = ?', [result.lastID]);
    res.json({ success: true, message: 'Waste log saved!', log });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.delete('/api/waste-logs/:id', async (req, res) => {
  try {
    await runAsync('DELETE FROM Waste_Logs WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// =============================================================================
// WARDEN STATS — aggregated analytics endpoint
// =============================================================================
app.get('/api/warden-stats', async (req, res) => {
  try {
    const today   = getTodayIST();
    const cursor  = new Date(today + 'T00:00:00+05:30');
    cursor.setDate(cursor.getDate() - 6); // 7 days ago
    const weekAgo = cursor.toISOString().split('T')[0];

    // Total expenditure (all time)
    const { total_spent } = await getAsync('SELECT COALESCE(SUM(amount), 0) AS total_spent FROM Purchases');

    // Weekly expenditure
    const { weekly_spent } = await getAsync(
      'SELECT COALESCE(SUM(amount), 0) AS weekly_spent FROM Purchases WHERE date >= ?', [weekAgo]
    );

    // Purchase count
    const { purchase_count } = await getAsync('SELECT COUNT(*) AS purchase_count FROM Purchases');

    // Last 5 purchases (for preview, no base64 image to keep response small)
    const recentPurchases = await allAsync(
      'SELECT id, date, amount, description FROM Purchases ORDER BY created_at DESC LIMIT 5'
    );

    // All bills (with image)
    const allPurchases = await allAsync(
      'SELECT id, date, amount, description, receipt_image FROM Purchases ORDER BY created_at DESC'
    );

    // Overall average rating for the last 7 days
    const { avg_rating, total_ratings } = await getAsync(
      `SELECT ROUND(AVG(stars), 1) AS avg_rating, COUNT(*) AS total_ratings FROM Ratings WHERE meal_date >= ?`,
      [weekAgo]
    );

    // Rating breakdown for 7 days
    const ratingBreakdown = await allAsync(
      `SELECT stars, COUNT(*) AS count FROM Ratings WHERE meal_date >= ? GROUP BY stars ORDER BY stars DESC`,
      [weekAgo]
    );

    // Top 3 most cancelled meal types (by count of cancellations for this week)
    const topCancelledMeals = await allAsync(
      `SELECT meal_type, COUNT(*) AS count FROM Daily_Meals
       WHERE cancelled = 1 AND date >= ? GROUP BY meal_type ORDER BY count DESC LIMIT 3`,
      [weekAgo]
    );

    // Top skipped dishes (cancelled with reason "Don't like this meal")
    const topSkippedDishes = await allAsync(
      `SELECT meal_type, COUNT(*) AS count FROM Daily_Meals
       WHERE cancelled = 1 AND LOWER(reason) LIKE '%don%t like%' AND date >= ?
       GROUP BY meal_type ORDER BY count DESC LIMIT 3`,
      [weekAgo]
    );

    // Also join with menu to get actual dish names when possible
    const topSkippedWithMenu = await allAsync(
      `SELECT dm.meal_type, COUNT(*) AS count,
              (SELECT wm.items FROM Weekly_Menu wm
               WHERE wm.day_of_week = CASE strftime('%w', dm.date)
                 WHEN '0' THEN 'Sunday' WHEN '1' THEN 'Monday' WHEN '2' THEN 'Tuesday'
                 WHEN '3' THEN 'Wednesday' WHEN '4' THEN 'Thursday' WHEN '5' THEN 'Friday'
                 ELSE 'Saturday' END AND wm.meal_type = dm.meal_type LIMIT 1) AS menu_items
       FROM Daily_Meals dm
       WHERE dm.cancelled = 1 AND dm.date >= ?
       GROUP BY dm.meal_type ORDER BY count DESC LIMIT 3`,
      [weekAgo]
    );

    // Total waste this week (kg)
    const { total_waste_kg } = await getAsync(
      'SELECT COALESCE(SUM(weight_kg), 0) AS total_waste_kg FROM Waste_Logs WHERE date >= ?', [weekAgo]
    );

    // Per-meal waste breakdown
    const wasteByMeal = await allAsync(
      'SELECT meal_type, ROUND(SUM(weight_kg), 2) AS total_kg FROM Waste_Logs WHERE date >= ? GROUP BY meal_type ORDER BY total_kg DESC',
      [weekAgo]
    );

    res.json({
      success: true,
      period: { from: weekAgo, to: today },
      financial: {
        total_spent:      parseFloat(total_spent.toFixed(2)),
        weekly_spent:     parseFloat(weekly_spent.toFixed(2)),
        purchase_count,
        recent_purchases: recentPurchases,
        all_purchases:    allPurchases,
      },
      satisfaction: {
        avg_rating:    avg_rating || null,
        total_ratings,
        breakdown:     [5,4,3,2,1].map(s => {
          const f = ratingBreakdown.find(r => r.stars === s);
          return { stars: s, count: f ? f.count : 0 };
        }),
      },
      cancellations: {
        top_cancelled_meals: topCancelledMeals,
        top_skipped_dishes:  topSkippedWithMenu,
      },
      waste: {
        total_waste_kg:  parseFloat(total_waste_kg.toFixed(2)),
        by_meal:         wasteByMeal,
      },
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// =============================================================================
// GENERAL ROUTES
// =============================================================================
app.get('/hostel-deliveries', async (req, res) => {
  const date = req.query.date || getTodayIST();
  if (date === getTodayIST()) return res.json({ success: true, date, counts: { ...hostelCounts } });
  try {
    const rows   = await allAsync('SELECT hostel, count FROM Hostel_Deliveries WHERE date = ?', [date]);
    const counts = HOSTELS.reduce((acc, h) => ({ ...acc, [h]: 0 }), {});
    for (const row of rows) { if (counts.hasOwnProperty(row.hostel)) counts[row.hostel] = row.count; }
    res.json({ success: true, date, counts });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/hostels', (req, res) => res.json({ success: true, hostels: HOSTELS }));

app.get('/students', async (req, res) => {
  try { res.json({ success: true, students: await allAsync('SELECT id, name, roll_number FROM Students LIMIT 10') }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/meal-status/:student_id/:date', async (req, res) => {
  const studentId = parseInt(req.params.student_id, 10);
  try {
    const rows = await allAsync('SELECT meal_type, cancelled FROM Daily_Meals WHERE student_id = ? AND date = ?', [studentId, req.params.date]);
    const statuses = { Breakfast: false, Lunch: false, Snacks: false, Dinner: false };
    for (const row of rows) statuses[row.meal_type] = row.cancelled === 1;
    res.json({ success: true, student_id: studentId, date: req.params.date, statuses });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/cancel-meal', async (req, res) => {
  const { student_id, date, meal_type, reason = '' } = req.body;
  if (!student_id || !date || !meal_type)
    return res.status(400).json({ success: false, error: 'student_id, date, and meal_type are required.' });
  if (!MEAL_TYPES.includes(meal_type))
    return res.status(400).json({ success: false, error: 'Invalid meal_type.' });
  try {
    const existing = await getAsync('SELECT id, cancelled FROM Daily_Meals WHERE student_id = ? AND date = ? AND meal_type = ?', [student_id, date, meal_type]);
    if (!existing) {
      await runAsync('INSERT INTO Daily_Meals (student_id, date, meal_type, cancelled, cancelled_at, reason) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, ?)', [student_id, date, meal_type, reason.trim()]);
      return res.json({ success: true, action: 'cancelled', meal_type, message: `${meal_type} cancelled.` });
    } else if (existing.cancelled === 1) {
      await runAsync('UPDATE Daily_Meals SET cancelled = 0, cancelled_at = NULL, reason = NULL WHERE student_id = ? AND date = ? AND meal_type = ?', [student_id, date, meal_type]);
      return res.json({ success: true, action: 'reinstated', meal_type, message: `${meal_type} reinstated.` });
    } else {
      await runAsync('UPDATE Daily_Meals SET cancelled = 1, cancelled_at = CURRENT_TIMESTAMP, reason = ? WHERE student_id = ? AND date = ? AND meal_type = ?', [reason.trim(), student_id, date, meal_type]);
      return res.json({ success: true, action: 'cancelled', meal_type, message: `${meal_type} cancelled.` });
    }
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/menu/:date', async (req, res) => {
  const dayName = getDayName(req.params.date);
  try {
    const rows = await allAsync('SELECT meal_type, items FROM Weekly_Menu WHERE day_of_week = ?', [dayName]);
    const menu = { Breakfast: '', Lunch: '', Snacks: '', Dinner: '' };
    for (const row of rows) menu[row.meal_type] = row.items;
    res.json({ success: true, date: req.params.date, day: dayName, menu });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/menu-week', async (req, res) => {
  try {
    const rows    = await allAsync('SELECT day_of_week, meal_type, items FROM Weekly_Menu');
    const weekMenu = {};
    for (const day of DAYS_OF_WEEK) weekMenu[day] = { Breakfast: '', Lunch: '', Snacks: '', Dinner: '' };
    for (const row of rows) { if (weekMenu[row.day_of_week]) weekMenu[row.day_of_week][row.meal_type] = row.items; }
    res.json({ success: true, menu: weekMenu });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.put('/menu', async (req, res) => {
  const menuData = req.body;
  if (!menuData || typeof menuData !== 'object')
    return res.status(400).json({ success: false, error: 'Invalid body.' });
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
  } catch (e) { await runAsync('ROLLBACK').catch(() => {}); res.status(500).json({ success: false, error: e.message }); }
});

app.post('/apply-leave', async (req, res) => {
  const { student_id, start_date, end_date } = req.body;
  if (!student_id || !start_date || !end_date)
    return res.status(400).json({ success: false, error: 'student_id, start_date, end_date required.' });
  if (new Date(end_date) < new Date(start_date))
    return res.status(400).json({ success: false, error: 'end_date must be on or after start_date.' });
  try {
    const student = await getAsync('SELECT id, name FROM Students WHERE id = ?', [student_id]);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found.' });
    await runAsync('INSERT INTO Leaves (student_id, start_date, end_date) VALUES (?, ?, ?)', [student_id, start_date, end_date]);
    const dates = getDatesInRange(start_date, end_date);
    let totalCancelled = 0;
    await runAsync('BEGIN TRANSACTION');
    for (const date of dates) {
      for (const mealType of MEAL_TYPES) {
        await runAsync('INSERT OR REPLACE INTO Daily_Meals (student_id, date, meal_type, cancelled, cancelled_at, reason) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, ?)', [student_id, date, mealType, 'Leave applied']);
        totalCancelled++;
      }
    }
    await runAsync('COMMIT');
    res.json({ success: true, message: `Leave applied for ${student.name}.`, days_count: dates.length, meals_cancelled: totalCancelled, start_date, end_date });
  } catch (e) { await runAsync('ROLLBACK').catch(() => {}); res.status(500).json({ success: false, error: e.message }); }
});

app.get('/audit-cancellations', async (req, res) => {
  const date  = req.query.date || getTodayIST();
  const month = date.substring(0, 7);
  try {
    const cancellations = await allAsync(`
      SELECT dm.id, dm.student_id, s.name, s.roll_number, dm.meal_type, dm.cancelled_at, dm.reason, dm.date,
        (SELECT COUNT(*) FROM Daily_Meals dm2 WHERE dm2.student_id = dm.student_id AND dm2.cancelled = 1 AND dm2.date LIKE ?) AS monthly_count
      FROM Daily_Meals dm JOIN Students s ON s.id = dm.student_id
      WHERE dm.date = ? AND dm.cancelled = 1 ORDER BY dm.cancelled_at DESC
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

// Fixed plate calculation
app.get('/dashboard', async (req, res) => {
  const today     = getTodayIST();
  const meal_type = req.query.meal_type || 'Lunch';
  const hostel    = req.query.hostel;
  if (!MEAL_TYPES.includes(meal_type))
    return res.status(400).json({ success: false, error: 'Invalid meal_type.' });
  try {
    const { count: mealCancellations }  = await getAsync(`SELECT COUNT(*) as count FROM Daily_Meals WHERE date = ? AND meal_type = ? AND cancelled = 1`, [today, meal_type]);
    const { count: orderedOnlineCount } = await getAsync(`SELECT COUNT(*) as count FROM Daily_Meals WHERE date = ? AND meal_type = ? AND cancelled = 1 AND LOWER(reason) = 'ordered online'`, [today, meal_type]);
    const { count: totalCancellations } = await getAsync(`SELECT COUNT(*) as count FROM Daily_Meals WHERE date = ? AND cancelled = 1`, [today]);
    const { count: guardDeliveries }    = await getAsync(`SELECT COUNT(*) as count FROM Delivery_Logs WHERE date = ?`, [today]);
    const extraDeductions = Math.max(0, guardDeliveries - orderedOnlineCount);
    const platesToPrepare = Math.max(0, TOTAL_ENROLLED - mealCancellations - extraDeductions);
    const reasonRows = await allAsync(`SELECT COALESCE(reason, 'Not specified') AS reason, COUNT(*) AS count FROM Daily_Meals WHERE date = ? AND meal_type = ? AND cancelled = 1 GROUP BY reason ORDER BY count DESC`, [today, meal_type]);
    const liveCount    = hostel && HOSTELS.includes(hostel) ? hostelCounts[hostel] : 0;
    res.json({
      success: true, date: today, meal_type,
      total_enrolled: TOTAL_ENROLLED, meal_cancellations: mealCancellations,
      ordered_online_count: orderedOnlineCount, total_cancellations: totalCancellations,
      guard_deliveries: guardDeliveries, extra_deductions: extraDeductions,
      plates_to_prepare: platesToPrepare, expected_attendance: Math.max(0, TOTAL_ENROLLED - mealCancellations),
      reason_breakdown: reasonRows, hostel: hostel || null,
      live_delivery_count: liveCount, traffic_level: hostel ? countToTrafficLevel(liveCount) : 'N/A',
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// =============================================================================
// START SERVER
// =============================================================================
server.listen(PORT, () => {
  console.log('\n' + '='.repeat(62));
  console.log('🚀  Mess Forecasting Backend v7 (Purchases + Waste + Warden)');
  console.log(`📡  HTTP  → http://localhost:${PORT}`);
  console.log(`🔌  WS    → ws://localhost:${PORT}`);
  console.log('🔑  Warden login: admin / admin123');
  console.log('='.repeat(62) + '\n');
});
