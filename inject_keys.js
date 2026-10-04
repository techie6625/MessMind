const fs = require('fs');

// 1. Replace Telegram Bot Token in server.js
const serverFile = 'backend/server.js';
let serverCode = fs.readFileSync(serverFile, 'utf8');
serverCode = serverCode.replace("'YOUR_TELEGRAM_BOT_TOKEN'", "'8964780311:AAGm-_nbygbwt8pDt3X4xIY2cS2amW1fXvY'");
fs.writeFileSync(serverFile, serverCode);

// 2. Replace Chat ID in App.js
const appFile = 'frontend/src/App.js';
let appCode = fs.readFileSync(appFile, 'utf8');
appCode = appCode.replace("'YOUR_CHAT_ID'", "'6818379808'");
fs.writeFileSync(appFile, appCode);

console.log('Keys injected successfully');
