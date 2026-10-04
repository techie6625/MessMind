const fs = require('fs');
let s = fs.readFileSync('backend/server.js', 'utf8');

s = s.replace(`app.post('/api/login', async (req, res) => {
  const { name, password, role } = req.body;
  // HARDCODED WARDEN BYPASS (Avoids SQLite CHECK constraint issues)
  if (name === 'admin' && password === 'admin123' && role === 'warden') {
    return res.json({ success: true, user: { id: 9999, name: 'admin', role: 'warden', hostel_name: '' } });
  }

  const { name, password, role } = req.body;`, `app.post('/api/login', async (req, res) => {
  const { name, password, role } = req.body;
  // HARDCODED WARDEN BYPASS
  if (name === 'admin' && password === 'admin123' && role === 'warden') {
    return res.json({ success: true, user: { id: 9999, name: 'admin', role: 'warden', hostel_name: '' } });
  }`);

fs.writeFileSync('backend/server.js', s);
