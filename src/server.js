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
const weddingEvents = [
  {
    key: "ceremony",
    title: "Rofel & Julie Ann Wedding Ceremony",
    description: "Join us as we say \"I do.\"",
    location: "Immaculate Conception Parish, Batac City, Ilocos Norte",
    start: "2026-05-18T14:00:00+08:00",
    end: "2026-05-18T15:30:00+08:00",
  },
  {
    key: "reception",
    title: "Rofel & Julie Ann Wedding Reception",
    description: "Dinner, dancing, and celebration right after the ceremony.",
    location: "Playa Tropical Resort, Currimao, Ilocos Norte",
    start: "2026-05-18T16:00:00+08:00",
    end: "2026-05-18T22:00:00+08:00",
  },
];

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

function formatGoogleDate(value) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function buildGoogleCalendarLink(event) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    details: event.description,
    location: event.location,
    dates: `${formatGoogleDate(event.start)}/${formatGoogleDate(event.end)}`,
    ctz: "Asia/Manila",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildMicrosoftCalendarLink(event, host) {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: new Date(event.start).toISOString(),
    enddt: new Date(event.end).toISOString(),
    body: event.description,
    location: event.location,
  });
  return `https://${host}/calendar/0/deeplink/compose?${params.toString()}`;
}

function buildIcsDocument(events) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rofel and Julie Ann//Wedding RSVP//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  events.forEach((event) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.key}@rganado.ca`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatGoogleDate(event.start)}`,
      `DTEND:${formatGoogleDate(event.end)}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
      `DESCRIPTION:${escapeIcsText(event.description)}`,
      `LOCATION:${escapeIcsText(event.location)}`,
      "END:VEVENT"
    );
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function buildCombinedGoogleEvent(events) {
  if (!events.length) return null;
  const sorted = [...events].sort((a, b) => new Date(a.start) - new Date(b.start));
  const start = sorted[0].start;
  const end = sorted[sorted.length - 1].end;
  return {
    title: "Rofel & Julie Ann Wedding Day",
    description:
      "Ceremony and reception celebration.\nCeremony: Immaculate Conception Parish, Batac City, Ilocos Norte.\nReception: Playa Tropical Resort, Currimao, Ilocos Norte.",
    location: "Batac City & Currimao, Ilocos Norte",
    start,
    end,
  };
}

function buildCalendarLinks(req) {
  const feedPath = "/calendar/wedding-events.ics";
  const downloadPath = `${feedPath}?download=1`;
  const protocol = req.protocol || "https";
  const host = req.get("host");
  const subscribeHttpsUrl = `${protocol}://${host}${feedPath}`;
  const subscribeWebcalUrl = `webcal://${host}${feedPath}`;
  return {
    feedPath,
    downloadPath,
    subscribeHttpsUrl,
    subscribeWebcalUrl,
  };
}

function formatEventDateTime(start, end, timeZone) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const dateFmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
  return {
    displayDate: dateFmt.format(startDate),
    displayTime: `${timeFmt.format(startDate)} - ${timeFmt.format(endDate)}`,
  };
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

app.get("/rsvp/thank-you", (req, res) => {
  const navLinks = [
    { href: "/", text: "Home" },
    { href: "/rsvp", text: "RSVP", active: true },
  ];
  const calendarLinks = buildCalendarLinks(req);
  const combinedGoogleEvent = buildCombinedGoogleEvent(weddingEvents);
  const { displayDate, displayTime } = formatEventDateTime(
    combinedGoogleEvent.start,
    combinedGoogleEvent.end,
    "Asia/Manila"
  );
  res.render("rsvp-thank-you", {
    navLinks,
    googleFallbackUrl: buildGoogleCalendarLink(combinedGoogleEvent),
    office365Url: buildMicrosoftCalendarLink(combinedGoogleEvent, "outlook.office.com"),
    outlookLiveUrl: buildMicrosoftCalendarLink(combinedGoogleEvent, "outlook.live.com"),
    googleDisplayDate: displayDate,
    googleDisplayTime: displayTime,
    allEventsIcsDownloadUrl: calendarLinks.downloadPath,
    allEventsIcsSubscribeWebcalUrl: calendarLinks.subscribeWebcalUrl,
    allEventsIcsSubscribeHttpsUrl: calendarLinks.subscribeHttpsUrl,
  });
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

app.get("/", (req, res) => {
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
  const calendarLinks = buildCalendarLinks(req);
  const combinedGoogleEvent = buildCombinedGoogleEvent(weddingEvents);
  const { displayDate, displayTime } = formatEventDateTime(
    combinedGoogleEvent.start,
    combinedGoogleEvent.end,
    "Asia/Manila"
  );
  res.render("home", {
    navLinks,
    galleryImages,
    calendarIcsDownloadUrl: calendarLinks.downloadPath,
    calendarIcsSubscribeWebcalUrl: calendarLinks.subscribeWebcalUrl,
    calendarIcsSubscribeHttpsUrl: calendarLinks.subscribeHttpsUrl,
    calendarGoogleUrl: buildGoogleCalendarLink(combinedGoogleEvent),
    calendarDisplayDate: displayDate,
    calendarDisplayTime: displayTime,
  });
});

app.get("/calendar/wedding-events.ics", (req, res) => {
  const icsContent = buildIcsDocument(weddingEvents);
  const isDownload = req.query.download === "1";
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  if (isDownload) {
    res.setHeader("Content-Disposition", 'attachment; filename="rofel-julieann-wedding.ics"');
  } else {
    res.setHeader("Content-Disposition", 'inline; filename="rofel-julieann-wedding.ics"');
  }
  res.send(icsContent);
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
