import { Router } from "express";
import db from "../db/index.js";

const router = Router();

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "changeme";
const ADMIN_COOKIE = "admin_auth";
const EXPORT_COLUMNS = [
  { key: "id", label: "Entry ID" },
  { key: "full_name", label: "Entry Name" },
  { key: "status", label: "Status" },
  { key: "guest_label", label: "Guest" },
  { key: "guest_name", label: "Guest Name" },
  { key: "guest_count", label: "Party Size" },
  { key: "email", label: "Email" },
  { key: "attendance", label: "Attendance" },
  { key: "needs_room_label", label: "Room" },
  { key: "room_count", label: "Room Count" },
  { key: "guest_allergies_label", label: "Guest Allergies" },
  { key: "food_allergies_label", label: "Party Allergies" },
  { key: "song_request", label: "Song" },
  { key: "message", label: "Message" },
  { key: "created_at", label: "Created" },
];

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

function normalizeRow(row) {
  const parsedAllergies = row.food_allergies
    ? (() => {
        try {
          return JSON.parse(row.food_allergies);
        } catch (_) {
          return row.food_allergies;
        }
      })()
    : [];

  const allergiesLabel = Array.isArray(parsedAllergies)
    ? parsedAllergies
        .map((guest) =>
          guest.name
            ? guest.name + (guest.allergies ? ` (${guest.allergies})` : "")
            : guest.allergies
        )
        .filter(Boolean)
        .join("; ")
    : parsedAllergies || "";

  const needsRoom = row.needs_room ? Boolean(Number(row.needs_room)) : false;
  const guestCount = Number.parseInt(row.guest_count, 10) || 0;
  const normalizedStatus = String(row.status || "active").toLowerCase();
  const guestDetails = Array.isArray(parsedAllergies)
    ? parsedAllergies.map((guest) => ({
        name: String(guest?.name || "").trim(),
        allergies: String(guest?.allergies || "").trim(),
      }))
    : [];
  const extraGuestsFromAllergies = Array.isArray(parsedAllergies)
    ? parsedAllergies
        .slice(1)
        .map((guest) => String(guest?.name || "").trim())
        .filter(Boolean)
    : [];
  const extraGuestsFromPlusOnes = String(row.plus_one_names || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const partyGuests = guestCount > 0
    ? [
        String(row.full_name || "").trim(),
        ...(extraGuestsFromAllergies.length ? extraGuestsFromAllergies : extraGuestsFromPlusOnes),
      ].slice(0, guestCount)
    : [];

  while (partyGuests.length < guestCount) {
    partyGuests.push("");
  }

  return {
    ...row,
    needs_room: needsRoom,
    needs_room_label: needsRoom ? "Yes" : "No",
    status: normalizedStatus,
    guest_count: guestCount,
    room_count: Number.parseInt(row.room_count, 10) || 0,
    food_allergies: parsedAllergies,
    food_allergies_label: allergiesLabel,
    guest_details: guestDetails,
    party_guests: partyGuests,
  };
}

async function getAdminRows() {
  const rows = await db.listRsvps();
  return rows.map(normalizeRow);
}

function getTotals(rows) {
  return rows.reduce(
    (acc, row) => {
      if (row.status === "deleted") {
        acc.deleted += 1;
        return acc;
      }
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
    { total: 0, yes: 0, maybe: 0, roomGuests: 0, roomReservations: 0, deleted: 0 }
  );
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char];
  });
}

function exportFileName(ext) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `rsvp-export-${stamp}.${ext}`;
}

function flattenExportRows(rows) {
  return rows.flatMap((row) => {
    const guestNames = row.party_guests?.length ? row.party_guests : [String(row.full_name || "").trim()];

    return guestNames.map((guestName, index) => {
      const guestDetail = row.guest_details?.[index];
      return {
        ...row,
        guest_label: `Guest ${index + 1}`,
        guest_name: guestName || "",
        guest_allergies_label: guestDetail?.allergies || "",
      };
    });
  });
}

function rowValue(row, column) {
  return row[column.key] ?? "";
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
    const rows = await getAdminRows();
    const totals = getTotals(rows);
    res.json({ ok: true, rows, totals });
  } catch (err) {
    console.error("Admin data fetch failed", err);
    res.status(500).json({ error: "Failed to fetch RSVPs" });
  }
});

router.get("/export", checkAuth, async (req, res) => {
  const format = String(req.query.format || "csv").toLowerCase();
  if (!["csv", "xls"].includes(format)) {
    return res.status(400).json({ error: "Export format must be csv or xls." });
  }

  try {
    const rows = await getAdminRows();
    const exportRows = flattenExportRows(
      rows.filter((row) => row.status !== "deleted")
    );

    if (format === "csv") {
      const header = EXPORT_COLUMNS.map((column) => escapeCsv(column.label)).join(",");
      const lines = exportRows.map((row) =>
        EXPORT_COLUMNS.map((column) => escapeCsv(rowValue(row, column))).join(",")
      );
      const csv = ["\uFEFF" + header, ...lines].join("\r\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${exportFileName("csv")}"`);
      return res.send(csv);
    }

    const headerCells = EXPORT_COLUMNS.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("");
    const bodyRows = exportRows
      .map((row) => {
        const cells = EXPORT_COLUMNS.map((column) => {
          const value = escapeHtml(rowValue(row, column)).replace(/\r?\n/g, "<br>");
          return `<td>${value}</td>`;
        }).join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #cfcfcf; padding: 6px; vertical-align: top; text-align: left; }
    th { background: #f2f2f2; }
  </style>
</head>
<body>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;

    res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${exportFileName("xls")}"`);
    return res.send(html);
  } catch (err) {
    console.error("Admin export failed", err);
    return res.status(500).json({ error: "Failed to export RSVPs" });
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
