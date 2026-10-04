const fs = require('fs');

let serverCode = fs.readFileSync('backend/server.js', 'utf8');

// The leftover block to remove
const leftover = `  
  try {
    await sendMealRSVP(chatId, mealType);
    res.json({ success: true, message: 'Demo notification sent!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});`;

serverCode = serverCode.replace(leftover, '');

fs.writeFileSync('backend/server.js', serverCode);
console.log('Leftovers removed');
