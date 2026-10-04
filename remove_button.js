const fs = require('fs');
let appCode = fs.readFileSync('frontend/src/App.js', 'utf8');

// The block to remove
const blockToRemoveRegex = /\s*<div className="mt-4 flex justify-center w-full">\s*<button[^>]*onClick=\{triggerTelegramDemo\}[^>]*>\s*<span className="text-lg">📲<\/span> Trigger Bot Demo\s*<\/button>\s*<\/div>/g;

appCode = appCode.replace(blockToRemoveRegex, '');

fs.writeFileSync('frontend/src/App.js', appCode);
console.log('Button removed successfully');
