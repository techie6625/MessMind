const fs = require('fs');
let s = fs.readFileSync('backend/server.js', 'utf8');

const target = `  const { name, password, role } = req.body;
  // HARDCODED WARDEN BYPASS (Avoids SQLite CHECK constraint issues)
  if (name === 'admin' && password === 'admin123' && role === 'warden') {
    return res.json({ success: true, user: { id: 9999, name: 'admin', role: 'warden', hostel_name: '' } });
  }

  const { name, password, role } = req.body;`;

const replacement = `  const { name, password, role } = req.body;
  // HARDCODED WARDEN BYPASS
  if (name === 'admin' && password === 'admin123' && role === 'warden') {
    return res.json({ success: true, user: { id: 9999, name: 'admin', role: 'warden', hostel_name: '' } });
  }`;

s = s.replace(target, replacement);

// Fallback regex
s = s.replace(/const \{ name, password, role \} = req\.body;\s*\/\/ HARDCODED WARDEN BYPASS[^{}]*\{\s*return res\.json\([^)]*\);\s*\}\s*const \{ name, password, role \} = req\.body;/gm, replacement);

fs.writeFileSync('backend/server.js', s);
