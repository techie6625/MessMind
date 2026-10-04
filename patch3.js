const fs = require('fs');

// TASK 1: server.js
let serverCode = fs.readFileSync('backend/server.js', 'utf8');

// Remove my previous patch if it exists
serverCode = serverCode.replace(/\/\/ GUARANTEE WARDEN CREDENTIALS[\s\S]*?\}\);/g, '');

const dbInject = `db.run(\`INSERT OR IGNORE INTO Users (name, password, role, hostel_name) VALUES ('admin', 'admin123', 'warden', 'none')\`);\ndb.run(\`UPDATE Users SET password = 'admin123', role = 'warden' WHERE name = 'admin'\`);\n\n`;

// Insert it right above server.listen
serverCode = serverCode.replace('server.listen(PORT', dbInject + 'server.listen(PORT');

fs.writeFileSync('backend/server.js', serverCode);


// TASK 2: LandingPage.jsx
let lpCode = fs.readFileSync('frontend/src/LandingPage.jsx', 'utf8');

// Clean up previous attempts (the ones I added before)
lpCode = lpCode.replace(/<div className="mt-6 text-center border-t border-white\/10 pt-4">[\s\S]*?<\/div>/g, '');
lpCode = lpCode.replace(/<div className="text-center mt-6">\s*<a href="\/warden"[\s\S]*?<\/a>\s*<\/div>/g, '');

const wardenSnippet = `
<div className="text-center mt-6">
  <a href="/warden" className="text-slate-400 hover:text-white text-sm font-bold border-b border-slate-600 hover:border-white transition-all">
    🏛️ Warden Portal (Admin)
  </a>
</div>`;

// Insert below the Role Selection grid (the first screen)
// The role selection ends with <div className="mt-8 text-center text-xs text-slate-600">
lpCode = lpCode.replace(/(<div className="mt-8 text-center text-xs text-slate-600">)/, wardenSnippet + '\n$1');

// And insert below the </form> tag as requested
lpCode = lpCode.replace(/<\/form>/, '</form>\n' + wardenSnippet);

fs.writeFileSync('frontend/src/LandingPage.jsx', lpCode);
console.log('patched exactly as requested');
