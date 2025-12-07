import express, { Router } from "express";
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
console.log(`Media uploads will be saved to: ${uploadsDir}`);
const allowedExt = /\.(jpe?g|png|gif|webp|avif)$/i;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, "_");
    cb(null, `${timestamp}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { files: 30, fileSize: 10 * 1024 * 1024 },
});
const uploadMany = upload.fields([{ name: "mediaFiles", maxCount: 10 }]);

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

// Serve uploads directly (cached) so gallery can display them
router.use(
  "/uploads",
  express.static(uploadsDir, { maxAge: "7d", fallthrough: true })
);

router.get("/", (req, res) => {
  const access = hasAccess(req);
  const open = isOpen();
  const navLinks = [
    { href: "/", text: "Home" },
    { href: "/rsvp", text: "RSVP" },
    { href: "/media", text: "Share Memories", active: true },
  ];
  if (access && open) {
    navLinks.push({ href: "/media/gallery", text: "Uploads" });
  }
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

router.post("/upload", hasMediaAccess, uploadMany, async (req, res) => {
  if (!isOpen()) {
    return res.status(403).json({ error: "Uploads open on wedding day." });
  }

  const files = (req.files && req.files.mediaFiles) || [];
  if (!files || files.length === 0) {
    console.warn("Media upload attempted with no files");
    return res.status(400).json({ error: "No files uploaded." });
  }

  const note = (req.body?.note || "").trim();

  const results = [];
  for (const file of files) {
    console.log(`Saved upload: ${file.filename} -> ${file.path}`);
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

router.get("/gallery", (req, res) => {
  if (!hasAccess(req)) {
    return unauthorized(res, "Access code required");
  }
  if (!isOpen()) {
    return res
      .status(403)
      .send("Uploads will open on the wedding day. Please check back later.");
  }
  const navLinks = [
    { href: "/", text: "Home" },
    { href: "/rsvp", text: "RSVP" },
    { href: "/media", text: "Share Memories" },
    { href: "/media/gallery", text: "Uploads", active: true },
  ];
  res.render("media-gallery", { navLinks });
});

router.get("/api/uploads", hasMediaAccess, (req, res) => {
  if (!isOpen()) {
    return res.status(403).json({ error: "Uploads open on wedding day." });
  }
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const pageSize = Math.min(
    50,
    Math.max(5, parseInt(req.query.pageSize || "20", 10))
  );

  let files = [];
  try {
    files = fs
      .readdirSync(uploadsDir)
      .filter((name) => allowedExt.test(name))
      .map((name) => {
        const full = path.join(uploadsDir, name);
        const stat = fs.statSync(full);
        return { name, mtime: stat.mtimeMs, size: stat.size };
      })
      .sort((a, b) => b.mtime - a.mtime);
  } catch (err) {
    console.error("Failed to list uploads", err);
    return res.status(500).json({ error: "Could not list uploads" });
  }

  const total = files.length;
  const start = (page - 1) * pageSize;
  const slice = files.slice(start, start + pageSize).map((f) => ({
    name: f.name,
    url: `/media/uploads/${encodeURIComponent(f.name)}`,
    thumbUrl: `/media/uploads/${encodeURIComponent(f.name)}`,
    size: f.size,
    uploadedAt: f.mtime,
  }));

  res.json({
    ok: true,
    page,
    pageSize,
    total,
    files: slice,
    hasMore: start + pageSize < total,
  });
});

function hasMediaAccess(req, res, next) {
  if (!hasAccess(req)) {
    return res.status(401).json({ error: "Access code required" });
  }
  return next();
}

// Upload error handler to make failures visible in logs and responses
router.use((err, _req, res, _next) => {
  console.error("Media upload failed:", err);
  const status = err instanceof multer.MulterError ? 400 : 500;
  const message =
    err instanceof multer.MulterError ? err.message : "Upload failed";
  res.status(status).json({ error: message });
});

export default router;
