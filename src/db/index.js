import path from "path";
import Database from "better-sqlite3";
import mysql from "mysql2/promise";
const client = (process.env.DB_CLIENT || "sqlite").toLowerCase();

let insertRsvp;
let listRsvps;
let deleteRsvp;
let updateRsvp;

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
        needs_room TINYINT(1) DEFAULT 0,
        room_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
  };

  const ensureColumns = async () => {
    const [cols] = await pool.query("SHOW COLUMNS FROM guests");
    const hasNeedsRoom = cols.some((c) => c.Field === "needs_room");
    const hasRoomCount = cols.some((c) => c.Field === "room_count");
    if (!hasNeedsRoom) {
      await pool.query("ALTER TABLE guests ADD COLUMN needs_room TINYINT(1) DEFAULT 0");
    }
    if (!hasRoomCount) {
      await pool.query("ALTER TABLE guests ADD COLUMN room_count INT DEFAULT 0");
    }
  };

  ensureTable()
    .then(ensureColumns)
    .catch((err) => console.error("MySQL init failed", err));

  insertRsvp = async ({
    name,
    email,
    guests,
    attendance,
    song,
    message,
    plusOneNames,
    allergies,
    roomNeeded,
    roomCount,
  }) => {
    const [result] = await pool.query(
      `INSERT INTO guests (full_name, email, attendance, guest_count, song_request, message, plus_one_names, food_allergies, needs_room, room_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        email,
        attendance,
        guests,
        song || null,
        message || null,
        plusOneNames || null,
        allergies || null,
        roomNeeded ? 1 : 0,
        roomCount || 0,
      ]
    );
    return { id: result.insertId };
  };

  listRsvps = async () => {
    const [rows] = await pool.query(
      "SELECT id, full_name, email, attendance, guest_count, song_request, message, plus_one_names, food_allergies, needs_room, room_count, created_at FROM guests ORDER BY created_at DESC"
    );
    return rows;
  };

  updateRsvp = async (id, payload) => {
    const {
      name,
      email,
      attendance,
      guests,
      song,
      message,
      plusOneNames,
      allergies,
      roomNeeded,
      roomCount,
    } = payload;
    await pool.query(
      `UPDATE guests
       SET full_name = ?, email = ?, attendance = ?, guest_count = ?, song_request = ?, message = ?, plus_one_names = ?, food_allergies = ?, needs_room = ?, room_count = ?
       WHERE id = ?`,
      [
        name,
        email,
        attendance,
        guests,
        song || null,
        message || null,
        plusOneNames || null,
        allergies || null,
        roomNeeded ? 1 : 0,
        roomCount || 0,
        id,
      ]
    );
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
      needs_room INTEGER DEFAULT 0,
      room_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();

  const columns = db.prepare("PRAGMA table_info(guests)").all();
  const hasPlusOne = columns.some((col) => col.name === "plus_one_names");
  const hasAllergy = columns.some((col) => col.name === "food_allergies");
  const hasNeedsRoom = columns.some((col) => col.name === "needs_room");
  const hasRoomCount = columns.some((col) => col.name === "room_count");
  if (!hasPlusOne) {
    db.prepare("ALTER TABLE guests ADD COLUMN plus_one_names TEXT").run();
  }
  if (!hasAllergy) {
    db.prepare("ALTER TABLE guests ADD COLUMN food_allergies TEXT").run();
  }
  if (!hasNeedsRoom) {
    db.prepare("ALTER TABLE guests ADD COLUMN needs_room INTEGER DEFAULT 0").run();
  }
  if (!hasRoomCount) {
    db.prepare("ALTER TABLE guests ADD COLUMN room_count INTEGER DEFAULT 0").run();
  }

  const insertStmt = db.prepare(
    `INSERT INTO guests (full_name, email, attendance, guest_count, song_request, message, plus_one_names, food_allergies, needs_room, room_count)
     VALUES (@name, @email, @attendance, @guests, @song, @message, @plusOneNames, @allergies, @roomNeeded, @roomCount)`
  );
  const listStmt = db.prepare(
    `SELECT id, full_name, email, attendance, guest_count, song_request, message, plus_one_names, food_allergies, needs_room, room_count, created_at
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
    roomNeeded,
    roomCount,
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
      roomNeeded: roomNeeded ? 1 : 0,
      roomCount: roomCount || 0,
    });
    return { id: result.lastInsertRowid };
  };

  listRsvps = async () => {
    return listStmt.all();
  };

  deleteRsvp = async (id) => {
    deleteStmt.run(id);
  };

  updateRsvp = async (id, payload) => {
    const {
      name,
      email,
      attendance,
      guests,
      song,
      message,
      plusOneNames,
      allergies,
      roomNeeded,
      roomCount,
    } = payload;
    db.prepare(
      `UPDATE guests
       SET full_name = @name,
           email = @email,
           attendance = @attendance,
           guest_count = @guests,
           song_request = @song,
           message = @message,
           plus_one_names = @plusOneNames,
           food_allergies = @allergies,
           needs_room = @roomNeeded,
           room_count = @roomCount
       WHERE id = @id`
    ).run({
      id,
      name,
      email,
      attendance,
      guests,
      song: song || null,
      message: message || null,
      plusOneNames: plusOneNames || null,
      allergies: allergies || null,
      roomNeeded: roomNeeded ? 1 : 0,
      roomCount: roomCount || 0,
    });
  };
}

export default { insertRsvp, listRsvps, deleteRsvp, updateRsvp };
