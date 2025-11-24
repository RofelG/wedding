import { Router } from "express";
import db from "../db/index.js";

const router = Router();

router.post("/", async (req, res) => {
  const { name, email, guests = 1, attendance, song, message } = req.body || {};

  if (!name || !email || !attendance) {
    return res.status(400).json({ error: "name, email, and attendance are required" });
  }

  const guestCount = Number.parseInt(guests, 10);
  if (Number.isNaN(guestCount) || guestCount < 1) {
    return res.status(400).json({ error: "guests must be a positive number" });
  }

  try {
    const result = await db.insertRsvp({
      name: name.trim(),
      email: email.trim(),
      guests: guestCount,
      attendance,
      song,
      message,
    });
    res.json({ ok: true, id: result.id });
  } catch (err) {
    console.error("Failed to save RSVP", err);
    res.status(500).json({ error: "Failed to save RSVP" });
  }
});

export default router;
