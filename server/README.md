# Liquid Planner API

Backend that holds each user's identity, saved plan, and MyPlan snapshot so the **web app** and the **SwiftUI app** share the same data after a Google/Apple login.

## Run

```bash
cd server
npm install
npm start          # http://localhost:8787  (npm run dev for auto-reload)
```

No secrets needed in dev — the prototype uses a demo login. Copy `.env.example` → `.env` and fill in `GOOGLE_CLIENT_ID` / `APPLE_CLIENT_ID` to enable real OAuth, and set a strong `APP_JWT_SECRET`.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | – | liveness + whether dev login is enabled |
| POST | `/api/auth/dev` | – | demo login → `{ token, user }` (disabled when `NODE_ENV=production`) |
| POST | `/api/auth/google` | – | verify Google ID token → `{ token, user }` |
| POST | `/api/auth/apple` | – | verify Apple ID token → `{ token, user }` |
| GET | `/api/me` | Bearer | current user |
| GET | `/api/plan` | Bearer | saved plan `{ chosen, schedule, completed, inProgress }` |
| PUT | `/api/plan` | Bearer | save plan (syncs across devices) |
| GET | `/api/snapshot` | Bearer | latest MyPlan/DARS snapshot |
| POST | `/api/snapshot` | Bearer | ingest a fresh scrape (the connect-and-read agent posts here) |

`token` is a 30-day app JWT (signed with `APP_JWT_SECRET`). Send it as `Authorization: Bearer <token>`.

## How the pieces connect

- **Sign in** (web or iOS) → provider ID token → `/api/auth/*` → app JWT.
- **Scrape** → the browser agent reads MyPlan once and `POST /api/snapshot`. Every device then `GET /api/snapshot` — no extension needed on phones.
- **Plan** → edits save to `/api/plan`; any device loads the same plan on login. That's the cross-device calendar.

## Storage

Dev uses a JSON file at `server/data/store.json` (zero native deps). For production swap `src/store.js` for SQLite or Postgres — the interface is four pairs of get/save functions.

## Deploy

Any Node host works (Render, Railway, Fly.io, a VM, or serverless with small tweaks). Set env vars, point the web app's `VITE_API_URL` and the SwiftUI app's base URL at the deployed URL. Put it behind HTTPS and set `CORS_ORIGINS` to your web origin.
