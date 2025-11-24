import { Router } from "express";
import db from "../db/index.js";

const router = Router();

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
