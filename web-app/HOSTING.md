# Hosting the Liquid Planner

The app is a **static site** (Vite + React, no backend yet), so it can be hosted anywhere that serves files. `vite.config.js` sets `base: "./"`, so the build works from a plain folder, a subpath, or a CDN.

## Important note on "hosting it myself"

I built and verified the app inside a temporary sandbox. That sandbox is **ephemeral and not reachable from the public internet**, so I can't give you a permanent live URL from here — any server I start there disappears when the session ends. What I *can* do, and have done, is build the production bundle and confirm it serves correctly (HTTP 200, all assets load). The three options below get it onto a real URL. The first runs on your own Mac in ~30 seconds; the others give you a public link for free.

## Option 1 — Run it on your own machine (fastest)

```bash
cd web-app
npm install        # first time only
npm run dev        # live-reload dev server → http://localhost:5173
```

Or serve the already-built production bundle:

```bash
npm run build      # outputs to dist/
npx serve dist    # → http://localhost:3000
```

To let other devices on your network reach it: `npm run dev -- --host`.

## Option 2 — Free public URL with Vercel (recommended for sharing)

```bash
npm install -g vercel
cd web-app
vercel             # follow prompts; accept defaults (Vite is auto-detected)
vercel --prod      # promote to your permanent *.vercel.app URL
```

No config needed — Vercel detects Vite, runs `npm run build`, and serves the output. Push the folder to GitHub and connect it in the Vercel dashboard for automatic deploys on every commit.

## Option 3 — Netlify (drag-and-drop or Git)

- **Drag-and-drop:** run `npm run build`, then drag the `dist/` folder onto https://app.netlify.com/drop. Instant URL.
- **Git:** push to GitHub and "Add new site → Import." The included `netlify.toml` handles the build settings automatically.

## Option 4 — GitHub Pages (free, tied to a repo)

```bash
npm install -D gh-pages
# add to package.json scripts:  "deploy": "vite build && gh-pages -d dist"
npm run deploy
```

Then enable Pages on the `gh-pages` branch in repo settings. Because `base` is `./`, it works under the `/<repo>/` subpath Pages uses.

## When the backend arrives

Transcript sync, real-time iOS/web sync, and live catalog scraping need a server + database (e.g. Supabase, Firebase, or a small Node API). At that point the recommended setup is: **Vercel** for the web frontend, a hosted Postgres (Supabase) for shared state, and the SwiftUI app talking to the same API — so the web and iOS planners stay in sync in real time.

## Build output

`npm run build` writes the production site to `dist/`. It's fully static — `index.html` plus hashed JS/CSS in `assets/`.
