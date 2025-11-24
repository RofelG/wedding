import path from "path";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rsvpRouter from "./routes/rsvp.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const accessCode = process.env.ACCESS_CODE || "LOVE2026";
const accessCookie = "rsvp_auth";
const publicDir = path.join(process.cwd(), "public");
const rsvpViewPath = path.join(process.cwd(), "src", "views", "rsvp.html");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(publicDir));

function hasAccess(req) {
  const cookie = req.headers.cookie || "";
  return cookie
    .split(";")
    .map((c) => c.trim())
    .some((c) => c.startsWith(`${accessCookie}=`));
}

function accessGate(message) {
  const alert = message
    ? `<div class="alert alert-danger mb-3" role="alert">${message}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>RSVP Access</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
</head>
<body class="bg-light">
  <div class="container py-5">
    <div class="row justify-content-center">
      <div class="col-md-6">
        <div class="card shadow-sm">
          <div class="card-body">
            <h1 class="h4 mb-3">Enter RSVP Code</h1>
            <p class="text-muted">This RSVP page is invitation-only. Please enter the access code to continue.</p>
            ${alert}
            <form method="POST" action="/rsvp/access">
              <div class="mb-3">
                <label for="code" class="form-label">Access Code</label>
                <input type="password" class="form-control" id="code" name="code" placeholder="Enter code" required />
              </div>
              <button class="btn btn-primary" type="submit">Continue</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

app.get("/rsvp", (req, res) => {
  if (!hasAccess(req)) {
    res.status(401).send(accessGate());
    return;
  }
  res.sendFile(rsvpViewPath);
});

app.get("/rsvp/:code", (req, res) => {
  const code = (req.params.code || "").trim();
  if (!code || code !== accessCode) {
    res.status(401).send(accessGate("Incorrect code. Please try again."));
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
    res.status(401).send(accessGate("Incorrect code. Please try again."));
    return;
  }
  res.setHeader(
    "Set-Cookie",
    `${accessCookie}=1; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24}`
  );
  res.redirect("/rsvp");
});

app.use("/api/rsvp", rsvpRouter);

app.listen(port, () => {
  console.log(`Wedding site running on http://localhost:${port}`);
});
