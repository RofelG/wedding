import { Router } from "express";
import db from "../db/index.js";

const router = Router();

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "changeme";
const ADMIN_COOKIE = "admin_auth";

function hasAdminCookie(req) {
  const cookie = req.headers.cookie || "";
  return cookie
    .split(";")
    .map((c) => c.trim())
    .some((c) => c.startsWith(`${ADMIN_COOKIE}=`));
}

function checkAuth(req, res, next) {
  // Allow either our cookie or Basic header (for backward compatibility)
  if (hasAdminCookie(req)) return next();

  const header = req.headers.authorization || "";
  if (header.startsWith("Basic ")) {
    const decoded = Buffer.from(header.replace("Basic ", ""), "base64").toString();
    const [user, pass] = decoded.split(":");
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      return next();
    }
  }

  // If HTML, redirect to login; otherwise send JSON
  const wantsHTML = (req.headers.accept || "").includes("text/html");
  if (wantsHTML) {
    return res.redirect("/admin/login");
  }
  return res.status(401).json({ error: "Unauthorized" });
}

router.use((req, res, next) => {
  res.set("X-Robots-Tag", "noindex, nofollow");
  next();
});

router.get("/login", (req, res) => {
  if (hasAdminCookie(req)) {
    return res.redirect("/admin");
  }
  res.render("admin-login");
});

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    res.setHeader(
      "Set-Cookie",
      `${ADMIN_COOKIE}=1; HttpOnly; Path=/admin; SameSite=Lax; Max-Age=${60 * 60 * 6}`
    );
    return res.redirect("/admin");
  }
  return res.status(401).render("admin-login", { error: "Invalid credentials" });
});

router.get("/logout", (_req, res) => {
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE}=; HttpOnly; Path=/admin; SameSite=Lax; Max-Age=0`
  );
  res.redirect("/admin/login");
});

router.get("/", checkAuth, (req, res) => {
  const navLinks = [
    { href: "/admin", text: "Admin", active: true },
    { href: "/admin/logout", text: "Logout" },
  ];
  res.render("admin", { navLinks });
});

router.get("/data", checkAuth, async (_req, res) => {
  try {
    const rows = await db.listRsvps();
    const mapped = rows.map((row) => ({
      ...row,
      needs_room: row.needs_room ? Boolean(Number(row.needs_room)) : false,
      room_count: Number.parseInt(row.room_count, 10) || 0,
      food_allergies: row.food_allergies
        ? (() => {
            try {
              return JSON.parse(row.food_allergies);
            } catch (_) {
              return row.food_allergies;
            }
          })()
        : [],
    }));
    const totals = mapped.reduce(
      (acc, row) => {
        const count = Number.parseInt(row.guest_count, 10) || 0;
        const roomGuests = row.needs_room ? Number.parseInt(row.room_count, 10) || 0 : 0;
        acc.total += count;
        acc.roomGuests += roomGuests;
        if (row.needs_room) acc.roomReservations += 1;
        if ((row.attendance || "").toLowerCase() === "yes") {
          acc.yes += count;
        }
        if ((row.attendance || "").toLowerCase() === "maybe") {
          acc.maybe += count;
        }
        return acc;
      },
      { total: 0, yes: 0, maybe: 0, roomGuests: 0, roomReservations: 0 }
    );
    res.json({ ok: true, rows: mapped, totals });
  } catch (err) {
    console.error("Admin data fetch failed", err);
    res.status(500).json({ error: "Failed to fetch RSVPs" });
  }
});

router.delete("/rsvp/:id", checkAuth, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid RSVP id" });
  }
  try {
    await db.deleteRsvp(id);
    res.json({ ok: true });
  } catch (err) {
    console.error("Admin delete failed", err);
    res.status(500).json({ error: "Failed to delete RSVP" });
  }
});

router.put("/rsvp/:id", checkAuth, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid RSVP id" });
  }
  const {
    full_name,
    email,
    attendance,
    guest_count,
    song_request,
    message,
    plus_one_names,
    food_allergies,
    needs_room,
    room_count,
  } = req.body || {};

  if (!full_name || !email || !attendance) {
    return res.status(400).json({ error: "Name, email, and attendance are required." });
  }

  const guestCount = Number.parseInt(guest_count, 10);
  if (!Number.isFinite(guestCount) || guestCount < 0) {
    return res.status(400).json({ error: "Guest count must be zero or more." });
  }

  const normalizedAttendance = attendance.toLowerCase();
  const allowedAttendance = ["yes", "no", "maybe"];
  if (!allowedAttendance.includes(normalizedAttendance)) {
    return res.status(400).json({ error: "Attendance must be yes, no, or maybe." });
  }

  const wantsRoom = needs_room === true || needs_room === "true" || needs_room === 1 || needs_room === "1";
  const roomCountNum = Number.parseInt(room_count, 10) || 0;
  if (wantsRoom && guestCount > 0 && roomCountNum > guestCount) {
    return res.status(400).json({ error: "Room count cannot exceed guest count." });
  }
  const normalizedRoomCount = wantsRoom ? roomCountNum : 0;

  try {
    await db.updateRsvp(id, {
      name: full_name.trim(),
      email: email.trim(),
      attendance: normalizedAttendance,
      guests: guestCount,
      song: song_request,
      message,
      plusOneNames: plus_one_names,
      allergies: food_allergies || null,
      roomNeeded: wantsRoom,
      roomCount: normalizedRoomCount,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Admin update failed", err);
    res.status(500).json({ error: "Failed to update RSVP" });
  }
});

export default router;
