# Production checklist

What's done and what you need to flip on to ship.

## Done in code

- **Sessions persist** — the web app stores its JWT in `localStorage` and restores it on reload and on other devices.
- **MyPlan handoff** — students log into MyPlan themselves and run a one-time bookmarklet that posts their DARS text to the backend (`/api/import/:code`), which parses it and saves the snapshot. No credentials touch this app. Paste-DARS and demo-data fallbacks included.
- **Backend hardening** — `x-powered-by` disabled, JSON body limit, 404 + error handlers, CORS via `CORS_ORIGINS`, demo login disabled when `NODE_ENV=production`, and the server refuses to boot in production with the default `APP_JWT_SECRET`.
- **Deploy artifacts** — `server/Dockerfile`, `Procfile`, `.dockerignore`, `.gitignore`.
- **Config** — web reads `VITE_API_URL`; server reads `PORT`, `APP_JWT_SECRET`, `GOOGLE_CLIENT_ID`, `APPLE_CLIENT_ID`, `CORS_ORIGINS`.

## You need to provide (accounts / secrets)

1. **Real OAuth client IDs.** Create a Google OAuth client and an Apple Services ID; set `GOOGLE_CLIENT_ID` / `APPLE_CLIENT_ID` on the server and swap the web `mockSignIn` for the real provider SDKs (hooks are in `web-app/src/auth.js`, server verification already implemented in `server/src/tokens.js`).
2. **A strong `APP_JWT_SECRET`** (e.g. `openssl rand -hex 32`).
3. **Hosting.** Deploy the server (Render/Railway/Fly/a VM/Docker) and the web build (Vercel/Netlify). Point `VITE_API_URL` at the server and `CORS_ORIGINS` at the web origin.
4. **A real database.** Swap `server/src/store.js` (JSON file) for SQLite or Postgres — same four get/save functions. The file store is fine for a pilot but not for scale.

## Deploy quickstart

```bash
# backend
cd server
docker build -t liquid-planner-api .
docker run -p 8787:8787 -e APP_JWT_SECRET=$(openssl rand -hex 32) -e NODE_ENV=production liquid-planner-api

# web
cd web-app
echo "VITE_API_URL=https://your-api-host" > .env
npm run build      # deploy dist/
```

## Honest limits

- The MyPlan handoff is a **bookmarklet** because UW exposes no third-party API and DARS sits behind Shibboleth + 2FA. This is the cleanest production-safe path: the student authenticates with UW directly and the data is pushed to us with their consent. A packaged browser extension would be a smoother version of the same idea.
- The DARS parser is regex-based against the current page format; if UW changes the layout it needs a tweak.
- Rate limiting, audit logging, and refresh-token rotation are not implemented — add before opening to the public.
