import { Router } from "express";
import rateLimit from "express-rate-limit";
import db from "../db/index.js";

const router = Router();
const ACCESS_COOKIE = process.env.ACCESS_COOKIE || "rsvp_auth";
const ACCESS_CODE = process.env.ACCESS_CODE;
const CAP_COOKIE = "rsvp_cap";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(limiter);

router.use((req, res, next) => {
  const cookie = req.headers.cookie || "";
  const hasCookie = cookie
    .split(";")
    .map((c) => c.trim())
    .some((c) => c.startsWith(`${ACCESS_COOKIE}=`));
  const headerCode = req.headers["x-access-code"];
  const hasHeaderAccess = ACCESS_CODE && headerCode === ACCESS_CODE;
  const capToken = cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CAP_COOKIE}=`));

  const capValue = (() => {
    if (!capToken) return null;
    const token = capToken.split("=")[1];
    const count = Number.parseInt(token, 10);
    if (!Number.isFinite(count) || count < 1) return null;
    return count;
  })();

  if (!hasCookie && !hasHeaderAccess) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!capValue) {
    return res.status(401).json({ error: "Missing or invalid invitation link" });
  }
  console.log(
    `[RSVP API] maxGuests=${capValue} attendance=${req.body?.attendance || "n/a"} guests=${req.body?.guests || "n/a"}`
  );
  req.maxGuests = capValue;
  next();
});

router.post("/", async (req, res) => {
  const {
    name,
    email,
    guests = 1,
    attendance,
    song,
    message,
    guestDetails,
  } = req.body || {};

  if (!name || !email || !attendance) {
    return res.status(400).json({ error: "name, email, and attendance are required" });
  }

  const guestCount = Number.parseInt(guests, 10);
  if (Number.isNaN(guestCount) || guestCount < 1) {
    return res.status(400).json({ error: "guests must be a positive number" });
  }
  if (req.maxGuests && guestCount > req.maxGuests) {
    return res
      .status(400)
      .json({ error: `Your invitation allows up to ${req.maxGuests} guest(s).` });
  }

  // Validate per-guest details when provided
  let perGuestDetails = [];
  if (Array.isArray(guestDetails)) {
    perGuestDetails = guestDetails.map((g) => ({
      name: (g?.name || "").trim(),
      allergies: g?.allergies ? String(g.allergies).trim() : "",
    }));
  }

  if (perGuestDetails.length !== guestCount) {
    return res.status(400).json({
      error: "Guest details are incomplete. Please provide names for each guest.",
    });
  }

  const missingNames = perGuestDetails.some((g) => !g.name);
  if (missingNames) {
    return res.status(400).json({ error: "Each guest needs a name." });
  }

  try {
    const additionalNames = perGuestDetails.slice(1).map((g) => g.name).join(", ");
    const allergiesJson = JSON.stringify(perGuestDetails);

    const result = await db.insertRsvp({
      name: name.trim(),
      email: email.trim(),
      guests: guestCount,
      attendance,
      song,
      message,
      plusOneNames: additionalNames || null,
      allergies: allergiesJson,
    });
    res.json({ ok: true, id: result.id });
  } catch (err) {
    console.error("Failed to save RSVP", err);
    res.status(500).json({ error: "Failed to save RSVP" });
  }
});

export default router;
