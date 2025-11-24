import path from "path";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rsvpRouter from "./routes/rsvp.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const publicDir = path.join(process.cwd(), "public");

app.use(cors());
app.use(express.json());
app.use(express.static(publicDir));

app.use("/api/rsvp", rsvpRouter);

app.listen(port, () => {
  console.log(`Wedding site running on http://localhost:${port}`);
});
