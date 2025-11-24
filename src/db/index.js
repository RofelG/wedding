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
      plus_one_names TEXT,
      food_allergies TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );

  // Backfill column if the table already existed without plus_one_names.
  db.all("PRAGMA table_info(guests)", (err, rows) => {
    if (err) {
      console.warn("Could not inspect guests table", err);
      return;
    }
    const hasPlusOne = rows.some((col) => col.name === "plus_one_names");
    const hasAllergy = rows.some((col) => col.name === "food_allergies");
    if (!hasPlusOne) {
      db.run("ALTER TABLE guests ADD COLUMN plus_one_names TEXT", (alterErr) => {
        if (alterErr) {
          console.warn("Could not add plus_one_names column", alterErr);
        }
      });
    }
    if (!hasAllergy) {
      db.run("ALTER TABLE guests ADD COLUMN food_allergies TEXT", (alterErr) => {
        if (alterErr) {
          console.warn("Could not add food_allergies column", alterErr);
        }
      });
    }
  });
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
  plusOneNames,
  allergies,
}) => {
  const result = await runAsync(
    `INSERT INTO guests (full_name, email, attendance, guest_count, song_request, message, plus_one_names, food_allergies)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      email,
      attendance,
      guests,
      song || null,
      message || null,
      plusOneNames || null,
      allergies || null,
    ]
  );
  return { id: result.id };
};

export default { insertRsvp };
