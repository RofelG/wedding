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
