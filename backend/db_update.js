const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./mess.db');

db.serialize(() => {
  db.run(`UPDATE Users SET password = 'admin123', role = 'warden' WHERE name = 'admin'`, function(e) {
    if (e) console.error(e);
    else console.log('Rows updated:', this.changes);

    if (this.changes === 0) {
      db.run(`INSERT INTO Users (name, mobile_no, password, role, hostel_name) VALUES ('admin', '9999999999', 'admin123', 'warden', 'none')`, function(err) {
        if (err) console.error(err);
        else console.log('Inserted admin user manually.');
      });
    }
  });
});
