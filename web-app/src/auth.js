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

// A stable-but-unique demo identity PER BROWSER, so two people never share an
// account in demo mode. (Production uses real Google→UW OAuth instead.)
function demoId() {
  try {
    let s = localStorage.getItem("lp_demo_id");
    if (!s) { s = Math.random().toString(36).slice(2, 10); localStorage.setItem("lp_demo_id", s); }
    return s;
  } catch { return Math.random().toString(36).slice(2, 10); }
}

export function mockSignIn(providerId) {
  const id = demoId();
  return new Promise((resolve) =>
    setTimeout(() => resolve({ name: "Demo Student", email: `demo-${id}@uw.edu`, provider: providerId }), 400)
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
