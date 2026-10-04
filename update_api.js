const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'frontend/src/App.js',
  'frontend/src/Dashboard.js',
  'frontend/src/GateGuardApp.js',
  'frontend/src/LandingPage.jsx',
  'frontend/src/Login.js',
  'frontend/src/WardenDashboard.js'
];

for (const file of filesToUpdate) {
  const filePath = path.resolve(file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    const newContent = content.replace(/http:\/\/localhost:3001/g, 'http://192.168.137.1:3001');
    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`Updated ${file}`);
    } else {
      console.log(`No match in ${file}`);
    }
  }
}
