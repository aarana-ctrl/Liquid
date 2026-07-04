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

// Robust CORS: allow explicitly-configured origins, PLUS any *.vercel.app
// deployment and localhost, so a misconfigured CORS_ORIGINS can't silently break
// the web app (every browser→API call was failing before because this origin
// wasn't whitelisted). Same-origin / non-browser callers (no Origin) pass too.
const origins = (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
const corsCheck = (origin, cb) => {
  if (!origin) return cb(null, true);
  if (origins.includes(origin)) return cb(null, true);
  try {
    const h = new URL(origin).hostname;
    if (/\.vercel\.app$/i.test(h) || h === "localhost" || h === "127.0.0.1") return cb(null, true);
  } catch { /* fall through */ }
  if (!origins.length) return cb(null, true); // fully permissive when unconfigured
  return cb(null, false);
};
app.use(cors({ origin: corsCheck }));

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
  const { chosen, schedule, completed, inProgress, majorId, majorName, minorIds, bookmarks } = req.body || {};
  const prev = (await getPlan(req.user.sub)) || {};
  res.json(await savePlan(req.user.sub, { ...prev, chosen, schedule, completed, inProgress, majorId, majorName, minorIds, bookmarks }));
});

// ---- Program catalog (the full UW major/minor list, scraped by the extension
// from the live DARS picker so it's always comprehensive and current) --------
// NOTE: Firestore reserves document ids matching /^__.*__$/, so the catalog key
// must NOT be wrapped in double underscores.
const CATALOG_KEY = "catalog_global";
app.get("/api/programs", cors({ origin: true }), async (req, res) => {
  try {
    const c = await getSnapshot(CATALOG_KEY);
    res.json({ majors: c?.majors || [], minors: c?.minors || [], updatedAt: c?.updatedAt || null });
  } catch (e) {
    console.error("programs GET failed:", e.message);
    res.json({ majors: [], minors: [], updatedAt: null }); // never break the app
  }
});
app.options("/api/programs", cors({ origin: true }));
app.post("/api/programs", cors({ origin: true }), auth, async (req, res) => {
  const { majors, minors } = req.body || {};
  if (!Array.isArray(majors) || !Array.isArray(minors)) return res.status(400).json({ error: "majors and minors arrays required" });
  await saveSnapshot(CATALOG_KEY, { majors: majors.slice(0, 600), minors: minors.slice(0, 400), updatedAt: new Date().toISOString() });
  res.json({ ok: true, majors: majors.length, minors: minors.length });
});

// ---- Auto-audit queue ------------------------------------------------------
// The web app enqueues programs it wants exact DARS data for; the extension
// reads this queue while the student is on MyPlan, runs "Audit a different
// program" for each, and imports the result (which clears it from the queue).
// Core program name for matching. DARS titles put the distinguishing name INSIDE
// parentheses ("Bachelor of Science (Psychology)", "Minor (Statistics)"), so use
// the parenthetical when present, then strip degree/level filler words.
const normName = (s) => {
  const str = String(s || "").toLowerCase();
  const paren = str.match(/\(([^)]+)\)/);
  return (paren ? paren[1] : str)
    .replace(/\b(bachelor|science|arts|minor|major|of|the|in|degree|b\.?s\.?|b\.?a\.?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim();
};
const nameMatch = (a, b) => { const x = normName(a), y = normName(b); return !!x && !!y && (x.includes(y) || y.includes(x)); };
app.get("/api/audit-queue", auth, async (req, res) => {
  const plan = (await getPlan(req.user.sub)) || {};
  res.json({ queue: plan.auditQueue || [] });
});
app.post("/api/audit-queue", auth, async (req, res) => {
  const { name, level } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  const plan = (await getPlan(req.user.sub)) || {};
  const queue = plan.auditQueue || [];
  // skip if already audited or already queued
  const snap = await getSnapshot(req.user.sub);
  const audited = snap?.programs && Object.values(snap.programs).some((p) => nameMatch(p.program, name));
  const exists = queue.some((q) => normName(q.name) === normName(name));
  if (!audited && !exists) queue.push({ name, level: level || "major", requestedAt: Date.now() });
  await savePlan(req.user.sub, { ...plan, auditQueue: queue });
  res.json({ queue, added: !audited && !exists });
});
app.post("/api/audit-queue/done", auth, async (req, res) => {
  const { name } = req.body || {};
  const plan = (await getPlan(req.user.sub)) || {};
  const queue = (plan.auditQueue || []).filter((q) => normName(q.name) !== normName(name));
  await savePlan(req.user.sub, { ...plan, auditQueue: queue });
  res.json({ queue });
});

// ---- MyPlan snapshot -------------------------------------------------------
// Merge a freshly-parsed DARS audit into the user's snapshot. The latest audit
// becomes the "current" snapshot (earned / in-progress / terms drive the
// planner), and every program the student has run through DARS is retained in a
// `programs` map keyed by program name — this is what makes Compare exact.
async function mergeProgramSnapshot(userId, snap) {
  const prev = (await getSnapshot(userId)) || {};
  const programs = { ...(prev.programs || {}) };
  const key = snap.program || "Degree";
  programs[key] = {
    program: snap.program,
    level: snap.level || "major",
    catalogYear: snap.catalogYear,
    gpa: snap.gpa,
    audit: snap.audit,
    requirements: snap.requirements || [],
    earned: snap.earned,
    inProgress: snap.inProgress,
    fetchedAt: snap.fetchedAt,
  };
  // Clear this program from the auto-audit queue now that we have its data.
  try {
    const plan = (await getPlan(userId)) || {};
    if (plan.auditQueue?.length) {
      const q = plan.auditQueue.filter((it) => !nameMatch(key, it.name));
      if (q.length !== plan.auditQueue.length) await savePlan(userId, { ...plan, auditQueue: q });
    }
  } catch { /* non-fatal */ }
  return saveSnapshot(userId, { ...snap, programs });
}

// GET: any device reads the latest scraped audit (with the per-program map).
app.get("/api/snapshot", auth, async (req, res) => res.json(await getSnapshot(req.user.sub)));
// POST: the connect-and-read agent ingests a fresh scrape (raw snapshot object).
app.post("/api/snapshot", auth, async (req, res) => {
  const snap = req.body?.snapshot;
  if (!snap || typeof snap !== "object") return res.status(400).json({ error: "snapshot required" });
  res.json(await saveSnapshot(req.user.sub, snap));
});

// Browser-extension import: the extension reads the student's DARS page and
// POSTs the text here, authenticated with the app JWT it picked up from the
// logged-in web app. Permissive CORS so the extension can call it from any origin.
app.options("/api/import/dars", cors({ origin: true }));
app.post("/api/import/dars", cors({ origin: true }), auth, async (req, res) => {
  const text = req.body?.darsText;
  if (!text || typeof text !== "string") return res.status(400).json({ error: "darsText required" });
  const snap = parseDars(text);
  const saved = await mergeProgramSnapshot(req.user.sub, snap);
  res.json({ ok: true, audit: snap.audit, program: snap.program, earnedCount: snap.earned.length, inProgressCount: snap.inProgress.length, programsKnown: Object.keys(saved.programs || {}).length });
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
  await mergeProgramSnapshot(rec.userId, snap);
  importCodes.delete(req.params.code);
  res.json({ ok: true, audit: snap.audit, program: snap.program, earnedCount: snap.earned.length, inProgressCount: snap.inProgress.length });
});

// 404 + error handler
app.use((req, res) => res.status(404).json({ error: "not found" }));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: "server error" }); });

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log(`Liquid Planner API on http://localhost:${PORT} (devLogin=${DEV_LOGIN}, oidc=${JSON.stringify(enabledProviders())}, store=${STORE_KIND})`));
