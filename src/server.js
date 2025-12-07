import "./config/loadEnv.js";
import path from "path";
import fs from "fs";
import express from "express";
import cors from "cors";
import rsvpRouter from "./routes/rsvp.js";
import adminRouter from "./routes/admin.js";
import mediaRouter from "./routes/media.js";

const app = express();
const port = process.env.PORT || 3000;
const accessCode = process.env.ACCESS_CODE || "LOVE2026";
const accessCookie = "rsvp_auth";
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

function hasAccess(req) {
  const cookie = req.headers.cookie || "";
  return cookie
    .split(";")
    .map((c) => c.trim())
    .some((c) => c.startsWith(`${accessCookie}=`));
}

function accessGate(res, navLinks, message) {
  res.status(401).render("rsvp-access", { navLinks, message });
}

app.get("/rsvp", (req, res) => {
  if (!hasAccess(req)) {
    const navLinks = [
      { href: "/", text: "Home" },
      { href: "/rsvp", text: "RSVP", active: true },
    ];
    accessGate(res, navLinks);
    return;
  }
  const navLinks = [
    { href: "/", text: "Home" },
    { href: "/rsvp", text: "RSVP", active: true },
  ];
  res.render("rsvp", { navLinks });
});

app.get("/rsvp/:code", (req, res) => {
  const code = (req.params.code || "").trim();
  if (!code || code !== accessCode) {
    const navLinks = [
      { href: "/", text: "Home" },
      { href: "/rsvp", text: "RSVP", active: true },
    ];
    accessGate(res, navLinks, "Incorrect code. Please try again.");
    return;
  }
  res.setHeader(
    "Set-Cookie",
    `${accessCookie}=1; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24}`
  );
  res.redirect("/rsvp");
});

app.post("/rsvp/access", (req, res) => {
  const code = (req.body?.code || "").trim();
  if (!code || code !== accessCode) {
    const navLinks = [
      { href: "/", text: "Home" },
      { href: "/rsvp", text: "RSVP", active: true },
    ];
    accessGate(res, navLinks, "Incorrect code. Please try again.");
    return;
  }
  res.setHeader(
    "Set-Cookie",
    `${accessCookie}=1; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24}`
  );
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
});
