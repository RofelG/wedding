import { Router } from "express";
import db from "../db/index.js";

const router = Router();

function unauthorized(res) {
  res.set("WWW-Authenticate", 'Basic realm="RSVP Admin"');
  return res.status(401).send("Unauthorized");
}

function checkAuth(req, res, next) {
  const ADMIN_USER = process.env.ADMIN_USER || "admin";
  const ADMIN_PASS = process.env.ADMIN_PASSWORD || "changeme";

  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) {
    return unauthorized(res);
  }
  const decoded = Buffer.from(header.replace("Basic ", ""), "base64").toString();
  const [user, pass] = decoded.split(":");
  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    return next();
  }
  return unauthorized(res);
}

router.use((req, res, next) => {
  res.set("X-Robots-Tag", "noindex, nofollow");
  next();
});

router.get("/", checkAuth, (req, res) => {
  res.sendFile("admin.html", { root: "src/views" });
});

router.get("/data", checkAuth, async (_req, res) => {
  try {
    const rows = await db.listRsvps();
    const mapped = rows.map((row) => ({
      ...row,
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
    res.json({ ok: true, rows: mapped });
  } catch (err) {
    console.error("Admin data fetch failed", err);
    res.status(500).json({ error: "Failed to fetch RSVPs" });
  }
});

export default router;
