const fs = require('fs');
let s = fs.readFileSync('backend/server.js', 'utf8');
s = s.replace(/cron\.schedule\([^)]*\)[^\n]*\n/g, '');
s = s.replace(/try\s*\{\s*await sendMealRSVP\([^)]*\);\s*res\.json\([^)]*\);\s*\}\s*catch\s*\(error\)\s*\{\s*res\.status\(500\)\.json\([^)]*\);\s*\}\s*\n\}\);\n/g, '');
fs.writeFileSync('backend/server.js', s);
