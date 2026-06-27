// File-backed store (dev / pilot). Async interface to match the Firestore store.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const FILE = join(DATA_DIR, "store.json");

let db = { users: {}, plans: {}, snapshots: {} };
if (existsSync(FILE)) { try { db = JSON.parse(readFileSync(FILE, "utf8")); } catch { /* keep default */ } }
function persist() { if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(FILE, JSON.stringify(db, null, 2)); }

export async function upsertUser({ id, email, name, provider }) {
  const ex = db.users[id] || {};
  db.users[id] = { id, email, name, provider, createdAt: ex.createdAt || new Date().toISOString(), lastLogin: new Date().toISOString() };
  persist(); return db.users[id];
}
export async function getUser(id) { return db.users[id] || null; }
export async function getPlan(userId) { return db.plans[userId] || { chosen: [], schedule: {}, completed: [], inProgress: [] }; }
export async function savePlan(userId, plan) { db.plans[userId] = { ...(db.plans[userId] || {}), ...plan, updatedAt: new Date().toISOString() }; persist(); return db.plans[userId]; }
export async function getSnapshot(userId) { return db.snapshots[userId] || null; }
export async function saveSnapshot(userId, snapshot) { db.snapshots[userId] = { ...snapshot, ingestedAt: new Date().toISOString() }; persist(); return db.snapshots[userId]; }
