const fs = require('fs');

let serverCode = fs.readFileSync('backend/server.js', 'utf8');

// 1. Remove Telegram Bot & Cron logic
const tgRegex = /\/\/ --- TELEGRAM BOT & CRON \(Meal RSVP\) ---[\s\S]*?cron\.schedule\([^)]*\)[^\n]*\n/g;
serverCode = serverCode.replace(tgRegex, '');

// 2. Remove Trigger Bot Demo endpoint
const endpointRegex = /\/\/ --- LIVE DEMO ENDPOINT ---[\s\S]*?app\.post\('\/api\/trigger-bot-demo'[\s\S]*?\}\);\n/g;
serverCode = serverCode.replace(endpointRegex, '');

fs.writeFileSync('backend/server.js', serverCode);
console.log('Telegram logic removed from server.js');
