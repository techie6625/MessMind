const fs = require('fs');
let s = fs.readFileSync('backend/server.js', 'utf8');

let newS = s.replace(`app.post('/api/login', async (req, res) => {
  const { name, password, role } = req.body;
  // HARDCODED WARDEN BYPASS (Avoids SQLite CHECK constraint issues)
  if (name === 'admin' && password === 'admin123' && role === 'warden') {
    return res.json({ success: true, user: { id: 9999, name: 'admin', role: 'warden', hostel_name: '' } });
  }

  const { name, password, role } = req.body;`, `app.post('/api/login', async (req, res) => {
  const { name, password, role } = req.body;
  // HARDCODED WARDEN BYPASS (Avoids SQLite CHECK constraint issues)
  if (name === 'admin' && password === 'admin123' && role === 'warden') {
    return res.json({ success: true, user: { id: 9999, name: 'admin', role: 'warden', hostel_name: '' } });
  }`);

if (newS === s) {
  // Try another regex
  newS = s.replace(/const \{ name, password, role \} = req\.body;\s*const \{ name, password, role \} = req\.body;/g, 'const { name, password, role } = req.body;');
}

fs.writeFileSync('backend/server.js', newS);
console.log('fixed');
