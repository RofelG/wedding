import "./config/loadEnv.js";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import express from "express";
import cors from "cors";
import rsvpRouter from "./routes/rsvp.js";
import adminRouter from "./routes/admin.js";
import mediaRouter from "./routes/media.js";

const app = express();
const port = process.env.PORT || 3000;
const capCookie = "rsvp_cap";
const tokenSecret = process.env.ACCESS_CODE || "LOVE2026";
const logoUrl = process.env.LOGO_URL || "";
const logoBase = process.env.LOGO_BASE || "";
const logoType = process.env.LOGO_TYPE || "";
const publicDir = path.join(process.cwd(), "public");
const viewsDir = path.join(process.cwd(), "src", "views");
const trustProxy = process.env.TRUST_PROXY || "1";

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(publicDir));
// Respect X-Forwarded-* headers when behind a proxy so rate limiting works
app.set("trust proxy", trustProxy);

app.set("view engine", "ejs");
app.set("views", viewsDir);

// Expose minimal config to the front-end
app.get("/config.js", (_req, res) => {
  res.type("application/javascript").send(`window.SITE_CONFIG = {
    logoUrl: ${JSON.stringify(logoUrl)},
    logoBase: ${JSON.stringify(logoBase)},
    logoType: ${JSON.stringify(logoType)}
  };`);
});

function signCount(count, secret) {
  const sig = crypto.createHmac("sha256", secret).update(String(count)).digest("hex");
  return `${count}.${sig}`;
}

function parseCapToken(token, secret) {
  if (!token) return null;
  const [countStr, sig] = token.split(".");
  const count = Number.parseInt(countStr, 10);
  if (!Number.isFinite(count) || count < 1 || !sig) return null;
  const expected = crypto.createHmac("sha256", secret).update(countStr).digest("hex");
  if (sig !== expected) return null;
  return count;
}

function getCapFromCookie(req) {
  const cookie = req.headers.cookie || "";
  const raw = cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${capCookie}=`));
  if (!raw) return null;
  const token = raw.split("=")[1];
  const parsed = Number.parseInt(token, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return parsed;
}

function accessGate(res, navLinks, message, capToken = "") {
  res.status(401).render("rsvp-access", { navLinks, message, capToken });
}

app.get("/rsvp", (req, res) => {
  const capFromCookie = getCapFromCookie(req);
  const maxGuests = capFromCookie;

  if (!maxGuests) {
    const navLinks = [
      { href: "/", text: "Home" },
      { href: "/rsvp", text: "RSVP", active: true },
    ];
    accessGate(res, navLinks, "Your invitation link is required to continue.");
    return;
  }

  const navLinks = [
    { href: "/", text: "Home" },
    { href: "/rsvp", text: "RSVP", active: true },
  ];
  res.render("rsvp", { navLinks, maxGuests });
});

app.get("/rsvp/:code", (req, res) => {
  const code = (req.params.code || "").trim();
  const capToken = (req.query.v || "").toString().trim();
  const capFromUrl = parseCapToken(capToken, tokenSecret);
  const capFromCookie = getCapFromCookie(req);
  const maxGuests = capFromUrl || capFromCookie;

  console.log(
    `[RSVP] GET /rsvp/${code} capFromUrl=${capFromUrl || "none"} capFromCookie=${capFromCookie || "none"}`
  );

  if (!maxGuests) {
    const navLinks = [
      { href: "/", text: "Home" },
      { href: "/rsvp", text: "RSVP", active: true },
    ];
    accessGate(res, navLinks, "Your invitation link is required to continue.", capToken);
    return;
  }

  if (!code) {
    const navLinks = [
      { href: "/", text: "Home" },
      { href: "/rsvp", text: "RSVP", active: true },
    ];
    accessGate(res, navLinks, "Incorrect link. Please try again.", capToken);
    return;
  }
  if (capFromUrl) {
    res.setHeader(
      "Set-Cookie",
      `${capCookie}=${capFromUrl}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24}`
    );
  }
  res.redirect("/rsvp");
});

app.post("/rsvp/access", (req, res) => {
  const capToken = (req.query.v || "").toString().trim();
  const capFromUrl = parseCapToken(capToken, tokenSecret);
  const capFromCookie = getCapFromCookie(req);
  const maxGuests = capFromUrl || capFromCookie;

  console.log(
    `[RSVP] POST /rsvp/access capFromUrl=${capFromUrl || "none"} capFromCookie=${capFromCookie || "none"}`
  );

  if (!maxGuests) {
    const navLinks = [
      { href: "/", text: "Home" },
      { href: "/rsvp", text: "RSVP", active: true },
    ];
    accessGate(res, navLinks, "Your invitation link is required to continue.", capToken);
    return;
  }

  if (capFromUrl) {
    res.setHeader(
      "Set-Cookie",
      `${capCookie}=${capToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24}`
    );
  }
  res.redirect("/rsvp");
});

app.get("/", (_req, res) => {
  const galleryDir = path.join(publicDir, "img", "gallery");
  let galleryImages = [];
  try {
    const files = fs.readdirSync(galleryDir);
    galleryImages = files
      .filter((f) => /\.(jpe?g|png|gif|webp|avif)$/i.test(f))
      .map((f) => `/img/gallery/${f}`);
  } catch (err) {
    console.warn("Could not read gallery directory", err.message);
  }

  const navLinks = [
    { href: "#story", text: "Our Story" },
    { href: "#details", text: "Details" },
    { href: "#gallery", text: "Gallery" },
    { href: "/rsvp", text: "RSVP" },
    { href: "/media", text: "Share Memories" },
  ];
  res.render("home", { navLinks, galleryImages });
});

app.use("/api/rsvp", rsvpRouter);
app.use("/admin", adminRouter);
app.use("/media", mediaRouter);

app.listen(port, () => {
  console.log(`Wedding site running on http://localhost:${port}`);
  // Log sample RSVP links for counts 1-4
  [1, 2, 3, 4].forEach((count) => {
    const token = signCount(count, tokenSecret);
    console.log(`Invite (max ${count}): /rsvp/${tokenSecret}?v=${token}`);
  });
});
