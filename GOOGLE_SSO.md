# UW NetID login via Google (no UW-IT registration)

UW NetIDs are Google Workspace accounts, and Google is already a UW-approved
identity provider. So a student can "Sign in with Google" using their **@uw.edu**
address, and Google itself redirects them to UW WebLogin (NetID + 2FA) and back.
We never register with UW-IT — we only register an ordinary Google OAuth client.

## What happens

1. Student clicks **Continue with Google**.
2. Our backend redirects to Google with `hd=uw.edu`.
3. Because the email is `@uw.edu`, Google hands the student to **UW WebLogin** for NetID + Duo 2FA.
4. UW returns the student to Google, Google returns an ID token to our backend.
5. We verify it, confirm `hd === uw.edu` (UW accounts only), mint a session, and drop the student into the planner.

## Setup (Google Cloud, ~10 min)

1. Go to console.cloud.google.com → create/select a project.
2. **APIs & Services → OAuth consent screen** → External (or Internal if you have a Workspace) → fill in app name + support email.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application.**
4. Add an **Authorized redirect URI**: `https://YOUR-API-HOST/api/auth/oidc/google/callback` (and `http://localhost:8787/api/auth/oidc/google/callback` for dev).
5. Copy the **Client ID** and **Client secret** into the server env:
   ```
   GOOGLE_OIDC_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_OIDC_CLIENT_SECRET=...
   GOOGLE_OIDC_REDIRECT_URI=https://YOUR-API-HOST/api/auth/oidc/google/callback
   GOOGLE_HD=uw.edu
   WEB_ORIGIN=https://YOUR-WEB-HOST
   ```
6. Restart the server. `GET /health` now shows `"oidc":{"google":true,...}`, the login screen says it routes through UW WebLogin, and the Google button does the real redirect.

## Notes

- `GOOGLE_HD=uw.edu` both hints the UW account chooser and is enforced server-side — non-UW Google accounts are rejected.
- This is the same Google OAuth used by countless apps; UW's federation does the NetID/2FA part automatically. If you later get a formal UW Entra registration, set the `OIDC_*` vars too and the NetID button will use that directly.
- Leave these unset and the buttons fall back to the demo sign-in, so local dev needs no secrets.
