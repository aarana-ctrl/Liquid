# Authentication

The app opens on a sign-in gate with **Continue with Google**, **Continue with Apple**, and **Continue with UW NetID**.

## Current state (prototype)

Sign-in is a **demo flow** — clicking a provider resolves a profile locally (`src/auth.js → mockSignIn`) without contacting Google/Apple. This lets the whole experience run with no backend. The UW NetID demo profile is `aarana@uw.edu`, matching the MyPlan snapshot so the audit lines up after sign-in.

## Going real

Real OAuth needs a backend to verify tokens and mint sessions; a static site can't do it securely alone. The app is structured so only `mockSignIn(providerId)` changes — everything downstream just consumes the returned `{ name, email, provider }`.

**Google** — Google Identity Services. Load `https://accounts.google.com/gsi/client`, configure your OAuth **Client ID** (Google Cloud Console → Credentials), render the button, and on the credential callback send the ID token to your backend to verify (`aud` = your client id) and create a session. Docs: developers.google.com/identity/gsi/web

**Apple** — Sign in with Apple JS. Register an App ID + Services ID and key in the Apple Developer portal, then `AppleID.auth.init({ clientId, redirectURI, scope, usePopup: true })` and `AppleID.auth.signIn()`. Verify the returned identity token server-side against Apple's public keys. Docs: developer.apple.com/sign-in-with-apple

**UW NetID** — production UW auth is Shibboleth/SSO. Note that signing in to the app is separate from the **MyPlan/DARS data pull**, which happens through the student's already-logged-in browser session (see `INTEGRATION.md`), not a server-held token.

## Fresh data on Connect

After sign-in, **Connect & pull from MyPlan (DARS)** fetches `student-snapshot.json` fresh on every click (cache-busted), so re-running a connect-and-read updates what the app shows. When the page is opened directly from disk (`file://`), browsers block local `fetch`, so it falls back to the embedded snapshot and labels it “(embedded)”. Served over http (dev server or a real host) it always pulls the live file.
