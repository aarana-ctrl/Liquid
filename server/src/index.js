import "dotenv/config"; // loads server/.env locally; no-op when the file is absent (e.g. on Render)
import crypto from "crypto";
import express from "express";
import cors from "cors";
import { verifyProviderToken, signAppToken, verifyAppToken } from "./tokens.js";
import { upsertUser, getUser, getPlan, savePlan, getSnapshot, saveSnapshot, STORE_KIND } from "./store.js";
import { parseDars } from "./dars.js";
import { providerEnabled, enabledProviders, authorizeUrl, handleCallback } from "./oidc.js";

const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:5173";

const PROD = process.env.NODE_ENV === "production";
// Production safety: refuse to boot with the insecure default secret.
if (PROD && (!process.env.APP_JWT_SECRET || process.env.APP_JWT_SECRET === "change-me-to-a-long-random-string")) {
  console.error("FATAL: set APP_JWT_SECRET to a strong value in production."); process.exit(1);
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

const origins = (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true }));

const DEV_LOGIN = !PROD; // allow demo login outside prod

// ---- auth middleware -------------------------------------------------------
function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing token" });
  try { req.user = verifyAppToken(token); next(); }
  catch { return res.status(401).json({ error: "invalid token" }); }
}

app.get("/health", (_req, res) => res.json({ ok: true, devLogin: DEV_LOGIN, oidc: enabledProviders(), store: STORE_KIND, time: new Date().toISOString() }));

// ---- SSO via OIDC (Google → UW NetID, or direct UW) ------------------------
// start -> redirect to the provider (Google sends @uw.edu to UW WebLogin + 2FA);
// callback -> exchange code, mint session, redirect back to the web app.
app.get("/api/auth/oidc/:provider/start", async (req, res) => {
  if (!providerEnabled(req.params.provider)) return res.status(501).json({ error: "provider not configured" });
  try { res.redirect(await authorizeUrl(req.params.provider)); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get("/api/auth/oidc/:provider/callback", async (req, res) => {
  if (!providerEnabled(req.params.provider)) return res.status(501).json({ error: "provider not configured" });
  try {
    const profile = await handleCallback(req.params.provider, { code: req.query.code, state: req.query.state });
    const user = await upsertUser(profile);
    res.redirect(`${WEB_ORIGIN}/#token=${encodeURIComponent(signAppToken(user))}`);
  } catch (e) {
    res.redirect(`${WEB_ORIGIN}/#auth_error=${encodeURIComponent(e.message)}`);
  }
});

// ---- sign in ---------------------------------------------------------------
// Demo login for the prototype UI (disabled when NODE_ENV=production).
// Defined before the :provider route so "dev" isn't captured as a provider.
app.post("/api/auth/dev", async (req, res) => {
  if (!DEV_LOGIN) return res.status(403).json({ error: "dev login disabled" });
  const { provider = "netid", email = "demo@uw.edu", name = "Demo Student" } = req.body || {};
  const id = `${provider}:${email}`;
  const user = await upsertUser({ id, email, name, provider });
  res.json({ token: signAppToken(user), user });
});

// Real OAuth: POST /api/auth/google|apple  { idToken }
app.post("/api/auth/:provider", async (req, res) => {
  const { provider } = req.params;
  if (!["google", "apple"].includes(provider)) return res.status(400).json({ error: "bad provider" });
  try {
    const profile = await verifyProviderToken(provider, req.body.idToken || "");
    const user = await upsertUser(profile);
    res.json({ token: signAppToken(user), user });
  } catch (e) {
    const status = e.code === "NOT_CONFIGURED" ? 501 : 401;
    res.status(status).json({ error: e.message });
  }
});

app.get("/api/me", auth, async (req, res) => {
  res.json((await getUser(req.user.sub)) || { id: req.user.sub, email: req.user.email, name: req.user.name, provider: req.user.provider });
});

// ---- plan (saved server-side → syncs across devices) -----------------------
app.get("/api/plan", auth, async (req, res) => res.json(await getPlan(req.user.sub)));
app.put("/api/plan", auth, async (req, res) => {
  const { chosen, schedule, completed, inProgress, majorId, minorIds } = req.body || {};
  res.json(await savePlan(req.user.sub, { chosen, schedule, completed, inProgress, majorId, minorIds }));
});

// ---- MyPlan snapshot -------------------------------------------------------
// GET: any device reads the latest scraped audit.
app.get("/api/snapshot", auth, async (req, res) => res.json(await getSnapshot(req.user.sub)));
// POST: the connect-and-read agent ingests a fresh scrape (raw snapshot object).
app.post("/api/snapshot", auth, async (req, res) => {
  const snap = req.body?.snapshot;
  if (!snap || typeof snap !== "object") return res.status(400).json({ error: "snapshot required" });
  res.json(await saveSnapshot(req.user.sub, snap));
});

// ---- MyPlan handoff (bookmarklet import) -----------------------------------
// The student logs into MyPlan themselves, then runs a one-time bookmarklet that
// POSTs the DARS page text here using a short-lived code tied to their account.
const importCodes = new Map(); // code -> { userId, exp }
function newCode() { return crypto.randomBytes(5).toString("hex"); }

app.post("/api/import/start", auth, (req, res) => {
  const code = newCode();
  importCodes.set(code, { userId: req.user.sub, exp: Date.now() + 10 * 60 * 1000 });
  res.json({ code, expiresInSec: 600 });
});

// Public but code-gated; permissive CORS so the bookmarklet can POST from myplan.uw.edu.
app.options("/api/import/:code", cors({ origin: true }));
app.post("/api/import/:code", cors({ origin: true }), async (req, res) => {
  const rec = importCodes.get(req.params.code);
  if (!rec || rec.exp < Date.now()) { importCodes.delete(req.params.code); return res.status(404).json({ error: "invalid or expired code" }); }
  const text = req.body?.darsText;
  if (!text || typeof text !== "string") return res.status(400).json({ error: "darsText required" });
  const snap = parseDars(text);
  await saveSnapshot(rec.userId, snap);
  importCodes.delete(req.params.code);
  res.json({ ok: true, audit: snap.audit, program: snap.program, earnedCount: snap.earned.length, inProgressCount: snap.inProgress.length });
});

// 404 + error handler
app.use((req, res) => res.status(404).json({ error: "not found" }));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: "server error" }); });

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log(`Liquid Planner API on http://localhost:${PORT} (devLogin=${DEV_LOGIN}, oidc=${JSON.stringify(enabledProviders())}, store=${STORE_KIND})`));
