import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { uploadToDrive } from "../services/drive.js";

const router = Router();
const MEDIA_COOKIE = process.env.MEDIA_COOKIE || "media_auth";
const MEDIA_CODE = process.env.MEDIA_ACCESS_CODE || process.env.ACCESS_CODE || "LOVE2026";
const MEDIA_OPEN_DATE = process.env.MEDIA_OPEN_DATE || "2026-05-18T00:00:00Z";
const MEDIA_FORCE_OPEN = process.env.MEDIA_FORCE_OPEN === "true";

const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, "_");
    cb(null, `${timestamp}-${safeName}`);
  },
});

const upload = multer({ storage });

function unauthorized(res, message = "Unauthorized") {
  res.status(401).send(message);
}

function hasAccess(req) {
  const cookie = req.headers.cookie || "";
  const hasCookie = cookie
    .split(";")
    .map((c) => c.trim())
    .some((c) => c.startsWith(`${MEDIA_COOKIE}=`));
  const headerCode = req.headers["x-access-code"];
  const hasHeaderAccess = headerCode && headerCode === MEDIA_CODE;
  return hasCookie || hasHeaderAccess;
}

function isOpen() {
  if (MEDIA_FORCE_OPEN) return true;
  const now = new Date();
  const openDate = new Date(MEDIA_OPEN_DATE);
  return now >= openDate;
}

router.use((req, res, next) => {
  res.set("X-Robots-Tag", "noindex, nofollow");
  next();
});

router.get("/", (req, res) => {
  const access = hasAccess(req);
  const open = isOpen();
  const navLinks = [
    { href: "/", text: "Home" },
    { href: "/rsvp", text: "RSVP" },
    { href: "/media", text: "Share Memories", active: true },
  ];
  res.render("media", {
    navLinks,
    hasAccess: access,
    isOpen: open,
  });
});

router.post("/access", (req, res) => {
  const code = (req.body?.code || "").trim();
  if (!code || code !== MEDIA_CODE) {
    return unauthorized(res, "Incorrect code. Please try again.");
  }
  res.setHeader(
    "Set-Cookie",
    `${MEDIA_COOKIE}=1; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24}`
  );
  res.redirect("/media");
});

router.post("/upload", hasMediaAccess, upload.array("mediaFiles", 10), async (req, res) => {
  if (!isOpen()) {
    return res.status(403).json({ error: "Uploads open on wedding day." });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files uploaded." });
  }

  const note = (req.body?.note || "").trim();

  const results = [];
  for (const file of req.files) {
    results.push({
      filename: file.filename,
      path: file.path,
    });

    // Attempt Drive upload (stubbed).
    await uploadToDrive(file.path, {
      originalName: file.originalname,
      note,
    }).catch((err) => {
      console.warn("Drive upload failed", err);
    });
  }

  res.json({ ok: true, count: results.length, files: results });
});

function hasMediaAccess(req, res, next) {
  if (!hasAccess(req)) {
    return res.status(401).json({ error: "Access code required" });
  }
  return next();
}

export default router;
