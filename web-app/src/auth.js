// ---------------------------------------------------------------------------
// Authentication providers.
//
// This prototype uses a DEMO sign-in: clicking a provider resolves a profile
// without contacting the provider. The functions are shaped so real OAuth drops
// in with minimal change — see the notes per provider below and AUTH.md.
// ---------------------------------------------------------------------------

export const PROVIDERS = {
  google: { id: "google", label: "Continue with Google" },
  apple: { id: "apple", label: "Continue with Apple" },
  netid: { id: "netid", label: "Continue with UW NetID" },
};

// Demo profiles returned by the mock flow. The UW NetID profile matches the
// MyPlan snapshot so the audit lines up after sign-in.
const DEMO_PROFILES = {
  google: { name: "Rana A.", email: "aarana@gmail.com", provider: "google" },
  apple: { name: "Rana A.", email: "rana@icloud.com", provider: "apple" },
  netid: { name: "aarana", email: "aarana@uw.edu", provider: "netid" },
};

export function mockSignIn(providerId) {
  return new Promise((resolve) =>
    setTimeout(() => resolve(DEMO_PROFILES[providerId] || DEMO_PROFILES.netid), 600)
  );
}

// ---------------------------------------------------------------------------
// Real OAuth, for when a backend + client IDs exist:
//
// GOOGLE  — Google Identity Services. Load https://accounts.google.com/gsi/client,
//   render a button with your OAuth Client ID, and on the credential callback
//   POST the ID token to your backend to verify (aud = your client id) and mint
//   a session. https://developers.google.com/identity/gsi/web
//
// APPLE   — Sign in with Apple JS. AppleID.auth.init({ clientId, redirectURI,
//   scope, usePopup:true }) then AppleID.auth.signIn(); verify the returned
//   identity token server-side against Apple's public keys.
//   https://developer.apple.com/sign-in-with-apple/
//
// UW      — Shibboleth / UW SSO for NetID is the production path for pulling
//   MyPlan/DARS, but that read currently happens through the logged-in browser
//   session (see INTEGRATION.md), not a server token.
//
// Swap mockSignIn(providerId) for the matching real call; the rest of the app
// only depends on the returned { name, email, provider } shape.
// ---------------------------------------------------------------------------
