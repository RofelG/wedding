import path from "path";
import Database from "better-sqlite3";
import mysql from "mysql2/promise";
const client = (process.env.DB_CLIENT || "sqlite").toLowerCase();

let insertRsvp;
let listRsvps;
let deleteRsvp;

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

  deleteRsvp = async (id) => {
    await pool.query("DELETE FROM guests WHERE id = ?", [id]);
  };
} else {
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), "wedding.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.prepare(
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
  ).run();

  const columns = db.prepare("PRAGMA table_info(guests)").all();
  const hasPlusOne = columns.some((col) => col.name === "plus_one_names");
  const hasAllergy = columns.some((col) => col.name === "food_allergies");
  if (!hasPlusOne) {
    db.prepare("ALTER TABLE guests ADD COLUMN plus_one_names TEXT").run();
  }
  if (!hasAllergy) {
    db.prepare("ALTER TABLE guests ADD COLUMN food_allergies TEXT").run();
  }

  const insertStmt = db.prepare(
    `INSERT INTO guests (full_name, email, attendance, guest_count, song_request, message, plus_one_names, food_allergies)
     VALUES (@name, @email, @attendance, @guests, @song, @message, @plusOneNames, @allergies)`
  );
  const listStmt = db.prepare(
    `SELECT id, full_name, email, attendance, guest_count, song_request, message, plus_one_names, food_allergies, created_at
     FROM guests
     ORDER BY created_at DESC`
  );
  const deleteStmt = db.prepare("DELETE FROM guests WHERE id = ?");

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
    const result = insertStmt.run({
      name,
      email,
      attendance,
      guests,
      song: song || null,
      message: message || null,
      plusOneNames: plusOneNames || null,
      allergies: allergies || null,
    });
    return { id: result.lastInsertRowid };
  };

  listRsvps = async () => {
    return listStmt.all();
  };

  deleteRsvp = async (id) => {
    deleteStmt.run(id);
  };
}

export default { insertRsvp, listRsvps, deleteRsvp };
