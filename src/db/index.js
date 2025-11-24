import path from "path";
import sqlite3 from "sqlite3";
import mysql from "mysql2/promise";
const client = (process.env.DB_CLIENT || "sqlite").toLowerCase();

let insertRsvp;
let listRsvps;

if (client === "mysql" || client === "mariadb") {

  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || "localhost",
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "wedding",
    port: Number(process.env.MYSQL_PORT || 3306),
    connectionLimit: Number(process.env.MYSQL_POOL || 10),
  });

  const ensureTable = async () => {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS guests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        attendance VARCHAR(20) NOT NULL,
        guest_count INT DEFAULT 1,
        song_request TEXT,
        message TEXT,
        plus_one_names TEXT,
        food_allergies TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
  };

  ensureTable().catch((err) => console.error("MySQL init failed", err));

  insertRsvp = async ({
    name,
    email,
    guests,
    attendance,
    song,
    message,
    plusOneNames,
    allergies,
  }) => {
    const [result] = await pool.query(
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
    return { id: result.insertId };
  };

  listRsvps = async () => {
    const [rows] = await pool.query(
      "SELECT id, full_name, email, attendance, guest_count, song_request, message, plus_one_names, food_allergies, created_at FROM guests ORDER BY created_at DESC"
    );
    return rows;
  };
} else {
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), "wedding.db");
  const sqlite = sqlite3.verbose();
  const db = new sqlite.Database(dbPath);

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

  insertRsvp = async ({
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

  listRsvps = async () => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, full_name, email, attendance, guest_count, song_request, message, plus_one_names, food_allergies, created_at
         FROM guests
         ORDER BY created_at DESC`,
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  };
}

export default { insertRsvp, listRsvps };
