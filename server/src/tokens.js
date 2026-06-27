// Token verification: real provider ID-token verification via JWKS (jose),
// plus our own session JWTs (jsonwebtoken).
import { createRemoteJWKSet, jwtVerify } from "jose";
import jwt from "jsonwebtoken";

const APP_SECRET = process.env.APP_JWT_SECRET || "dev-insecure-secret";

const PROVIDERS = {
  google: {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    jwks: createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")),
    audience: () => (process.env.GOOGLE_CLIENT_ID || "").split(",").map((s) => s.trim()).filter(Boolean),
  },
  apple: {
    issuer: ["https://appleid.apple.com"],
    jwks: createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys")),
    audience: () => (process.env.APPLE_CLIENT_ID || "").split(",").map((s) => s.trim()).filter(Boolean),
  },
};

// Verify a provider ID token. Returns a normalized profile.
export async function verifyProviderToken(provider, idToken) {
  const cfg = PROVIDERS[provider];
  if (!cfg) throw new Error("unknown provider");
  const audience = cfg.audience();
  if (audience.length === 0) {
    const err = new Error(`${provider.toUpperCase()}_CLIENT_ID not configured`);
    err.code = "NOT_CONFIGURED";
    throw err;
  }
  const { payload } = await jwtVerify(idToken, cfg.jwks, { issuer: cfg.issuer, audience });
  return {
    id: `${provider}:${payload.sub}`,
    sub: payload.sub,
    email: payload.email || "",
    name: payload.name || payload.email || "Student",
    provider,
  };
}

export function signAppToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name, provider: user.provider }, APP_SECRET, { expiresIn: "30d" });
}
export function verifyAppToken(token) {
  return jwt.verify(token, APP_SECRET); // throws on invalid/expired
}
