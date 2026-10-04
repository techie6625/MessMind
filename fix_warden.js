const fs = require('fs');

let serverCode = fs.readFileSync('backend/server.js', 'utf8');

serverCode = serverCode.replace(/app\.listen\(/, `
  // GUARANTEE WARDEN CREDENTIALS
  db.run("UPDATE Users SET password = 'admin123', role = 'warden' WHERE name = 'admin'", function(err) {
    if (!err && this.changes === 0) {
      db.run("INSERT INTO Users (name, mobile_no, password, role, hostel_name) VALUES ('admin', '9999999999', 'admin123', 'warden', '')");
    }
  });

  app.listen(`);

fs.writeFileSync('backend/server.js', serverCode);
console.log('Backend patched.');

let lp = fs.readFileSync('frontend/src/LandingPage.jsx', 'utf8');

if (!lp.includes('Warden Portal (Admin)')) {
  const linkHtml = `
        <div className="mt-6 text-center border-t border-white/10 pt-4">
          <button 
            onClick={() => window.location.href = '/warden'} 
            className="text-[10px] uppercase tracking-widest font-bold text-slate-500 hover:text-violet-400 transition-colors"
          >
            🏛️ Warden Portal (Admin)
          </button>
        </div>`;
  
  lp = lp.replace(/(\s*)(<\/div>\s*<\/div>\s*<\/div>\s*\)\;\s*\}\s*)$/m, (match, p1, p2) => {
    return p1 + linkHtml + match;
  });

  fs.writeFileSync('frontend/src/LandingPage.jsx', lp);
  console.log('LandingPage patched.');
}
