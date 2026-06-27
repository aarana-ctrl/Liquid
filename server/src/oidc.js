// OIDC Authorization-Code + PKCE login, multi-provider.
//
// Two ways to sign a UW student in:
//   • "google" — Google OIDC. Because UW federates NetID into Google Workspace,
//     a student entering their @uw.edu address is redirected by Google to UW
//     WebLogin (NetID + 2FA), then back — no UW-IT app registration needed.
//     Setting GOOGLE_HD=uw.edu restricts logins to UW accounts.
//   • "uw" — direct UW Entra/Shibboleth OIDC, if you later register with UW-IT.
//
// Env per provider:
//   GOOGLE_OIDC_CLIENT_ID / _SECRET / _REDIRECT_URI   (+ optional GOOGLE_HD)
//   OIDC_ISSUER + OIDC_CLIENT_ID / _SECRET / _REDIRECT_URI
import crypto from "crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

function build(name, issuer, idEnv, secEnv, redEnv, scopesDefault, hd) {
  const clientId = process.env[idEnv], clientSecret = process.env[secEnv], redirectUri = process.env[redEnv];
  if (!issuer || !clientId || !clientSecret || !redirectUri) return null;
  return { name, issuer, clientId, clientSecret, redirectUri, scopes: scopesDefault, hd: hd || "" };
}

const PROVIDERS = {};
{
  const g = build("google", "https://accounts.google.com", "GOOGLE_OIDC_CLIENT_ID", "GOOGLE_OIDC_CLIENT_SECRET", "GOOGLE_OIDC_REDIRECT_URI", "openid email profile", process.env.GOOGLE_HD);
  if (g) PROVIDERS.google = g;
  const u = build("uw", process.env.OIDC_ISSUER, "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "OIDC_REDIRECT_URI", process.env.OIDC_SCOPES || "openid profile email");
  if (u) PROVIDERS.uw = u;
}

export const providerEnabled = (name) => !!PROVIDERS[name];
export const enabledProviders = () => ({ google: !!PROVIDERS.google, uw: !!PROVIDERS.uw });

const discCache = {}, jwksCache = {};
async function discover(p) {
  if (discCache[p.issuer]) return discCache[p.issuer];
  const r = await fetch(p.issuer.replace(/\/$/, "") + "/.well-known/openid-configuration");
  if (!r.ok) throw new Error("OIDC discovery failed");
  const cfg = await r.json();
  discCache[p.issuer] = cfg; jwksCache[p.issuer] = createRemoteJWKSet(new URL(cfg.jwks_uri));
  return cfg;
}

const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const pending = new Map(); // state -> { provider, verifier, nonce, exp }

export async function authorizeUrl(name) {
  const p = PROVIDERS[name]; if (!p) throw new Error("provider not enabled");
  const cfg = await discover(p);
  const state = b64url(crypto.randomBytes(16)), nonce = b64url(crypto.randomBytes(16));
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  pending.set(state, { provider: name, verifier, nonce, exp: Date.now() + 10 * 60 * 1000 });
  const params = new URLSearchParams({
    client_id: p.clientId, response_type: "code", redirect_uri: p.redirectUri,
    scope: p.scopes, state, nonce, code_challenge: challenge, code_challenge_method: "S256",
  });
  if (p.hd) params.set("hd", p.hd); // hint/limit to the UW Google domain
  return `${cfg.authorization_endpoint}?${params.toString()}`;
}

export async function handleCallback(name, { code, state }) {
  const rec = pending.get(state);
  if (!rec || rec.provider !== name || rec.exp < Date.now()) { pending.delete(state); throw new Error("invalid state"); }
  pending.delete(state);
  const p = PROVIDERS[name]; const cfg = await discover(p);

  const tr = await fetch(cfg.token_endpoint, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: p.redirectUri, client_id: p.clientId, client_secret: p.clientSecret, code_verifier: rec.verifier }),
  });
  if (!tr.ok) throw new Error("token exchange failed");
  const tokens = await tr.json();

  const { payload } = await jwtVerify(tokens.id_token, jwksCache[p.issuer], { issuer: cfg.issuer, audience: p.clientId });
  if (rec.nonce && payload.nonce && payload.nonce !== rec.nonce) throw new Error("nonce mismatch");
  if (p.hd && payload.hd && payload.hd !== p.hd) throw new Error("not a UW (@" + p.hd + ") account");

  const email = payload.email || payload.preferred_username || "";
  const netid = email.split("@")[0] || payload.sub;
  // Both paths are a UW login; tag provider "netid" so the UI treats them the same.
  return { id: `${name}:${payload.sub}`, email, name: payload.name || netid, provider: "netid" };
}
