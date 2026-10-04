const fs = require('fs');
let s = fs.readFileSync('backend/server.js', 'utf8');
s = s.replace('// START SERVER', `db.run(\`INSERT OR IGNORE INTO Users (name, password, role, hostel_name) VALUES ('admin', 'admin123', 'warden', 'none')\`);
db.run(\`UPDATE Users SET password = 'admin123', role = 'warden' WHERE name = 'admin'\`);

// START SERVER`);
fs.writeFileSync('backend/server.js', s);

let lp = fs.readFileSync('frontend/src/LandingPage.jsx', 'utf8');
lp = lp.replace('</form>', `</form>

<div className="text-center mt-6">
  <a href="/warden" className="text-slate-400 hover:text-white text-sm font-bold border-b border-slate-600 hover:border-white transition-all">
    🏛️ Warden Portal (Admin)
  </a>
</div>`);
fs.writeFileSync('frontend/src/LandingPage.jsx', lp);
console.log('patched');
