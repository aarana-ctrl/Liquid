// API client for the Liquid Planner backend.
// Falls back gracefully: if the server isn't reachable, the app runs in local
// mode (demo sign-in, snapshot from the bundled file, plan kept in memory).

export const API_BASE = import.meta.env?.VITE_API_URL || "http://localhost:8787";

let _online = null;
export function isOnline() { return _online; }

export async function apiHealth() {
  try {
    const r = await fetch(`${API_BASE}/health`, { cache: "no-store" });
    _online = r.ok;
  } catch { _online = false; }
  return _online;
}

const authHeaders = (token) => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` });

// Demo login (prototype). Swap for /api/auth/google|apple with a real ID token.
export async function devLogin(profile) {
  const r = await fetch(`${API_BASE}/api/auth/dev`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile),
  });
  if (!r.ok) throw new Error(`login ${r.status}`);
  return r.json(); // { token, user }
}

// Real OAuth path (used in production):
export async function oauthLogin(provider, idToken) {
  const r = await fetch(`${API_BASE}/api/auth/${provider}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }),
  });
  if (!r.ok) throw new Error(`login ${r.status}`);
  return r.json();
}

export async function getPlan(token) {
  const r = await fetch(`${API_BASE}/api/plan`, { headers: authHeaders(token) });
  return r.ok ? r.json() : null;
}
export async function savePlan(token, plan) {
  const r = await fetch(`${API_BASE}/api/plan`, { method: "PUT", headers: authHeaders(token), body: JSON.stringify(plan) });
  return r.ok ? r.json() : null;
}
export async function getSnapshot(token) {
  const r = await fetch(`${API_BASE}/api/snapshot`, { headers: authHeaders(token) });
  return r.ok ? r.json() : null;
}
export async function postSnapshot(token, snapshot) {
  const r = await fetch(`${API_BASE}/api/snapshot`, { method: "POST", headers: authHeaders(token), body: JSON.stringify({ snapshot }) });
  return r.ok ? r.json() : null;
}
