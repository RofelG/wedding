import sqlite3 from "sqlite3";
import path from "path";

const dbPath = process.env.DB_PATH || path.join(process.cwd(), "wedding.db");
const sqlite = sqlite3.verbose();
const db = new sqlite.Database(dbPath);

// Ensure table exists; minimal schema for RSVPs/guests.
db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      attendance TEXT NOT NULL,
      guest_count INTEGER DEFAULT 1,
      song_request TEXT,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );
});

function runAsync(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

const insertRsvp = async ({
  name,
  email,
  guests,
  attendance,
  song,
  message,
}) => {
  const result = await runAsync(
    `INSERT INTO guests (full_name, email, attendance, guest_count, song_request, message)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, email, attendance, guests, song || null, message || null]
  );
  return { id: result.id };
};

export default { insertRsvp };
