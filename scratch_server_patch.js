const fs = require('fs');

let c = fs.readFileSync('backend/server.js', 'utf8');

// Insert Warden Seeder if not exists
if (!c.includes("admin123")) {
  c = c.replace(/const getTodayIST = \(\) =>/, `// --- WARDEN DB SEEDER ---\ndb.run(\`INSERT OR IGNORE INTO Users (name, password, role, hostel_name) VALUES ('admin', 'admin123', 'warden', '')\`);\n\nconst getTodayIST = () =>`);
}

// Replace warden stats
const targetRegex = /app\.get\('\/api\/warden-stats', async \(req, res\) => \{[\s\S]*?(?=\n\/\/ \=\=\=|\napp\.)/m;
const replacement = `app.get('/api/warden-stats', async (req, res) => {
  try {
    const today = new Date();
    today.setDate(today.getDate() - 7);
    const weekAgo = today.toISOString().split('T')[0];

    // Metric 1: Total Money Spent
    const { totalSpent } = await getAsync('SELECT COALESCE(SUM(amount), 0) AS totalSpent FROM Purchases');

    // Metric 2: Average Food Rating (Last 7 Days)
    const { averageRating } = await getAsync(
      'SELECT COALESCE(ROUND(AVG(stars), 1), 0) AS averageRating FROM Ratings WHERE meal_date >= ?',
      [weekAgo]
    );

    // Metric 3: Top 3 Skipped Meals (Last 7 Days)
    const topSkippedMeals = await allAsync(
      'SELECT meal_type, COUNT(*) AS count FROM Daily_Meals WHERE cancelled = 1 AND date >= ? GROUP BY meal_type ORDER BY count DESC LIMIT 3',
      [weekAgo]
    );

    res.json({ success: true, totalSpent, averageRating, topSkippedMeals });
  } catch (error) {
    console.error('Warden Stats Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
`;

if (targetRegex.test(c)) {
  c = c.replace(targetRegex, replacement);
} else {
  // Append before app.listen if not found
  c = c.replace(/(app\.listen\()/, replacement + '\n$1');
}

fs.writeFileSync('backend/server.js', c);
console.log("server.js updated");
