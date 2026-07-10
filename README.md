<div align="center">

#Liquid

### A liquid-glass degree planner for the University of Washington — powered by *your real* MyPlan, DARS, DawgPath, and RateMyProfessors data.

Plan every quarter, compare majors and minors with exact per-category requirements, and see grade distributions, professor ratings, and live seat counts for any course — all in one calm, glassy interface.

</div>

---

## What is Liquid?

UW students juggle a lot of tabs: **MyPlan** to build a schedule, **DARS** to audit degree progress, **DawgPath** to check grade distributions, and **RateMyProfessors** to size up instructors. Liquid pulls all of it into a single, beautiful planning surface — and keeps the numbers *exact* by reading your own signed-in university data through a companion browser extension, so nothing is copy-pasted or guessed.

It answers the questions students actually ask:

- *"What's left for my degree, and which gen-eds knock out the most requirements at once?"*
- *"If I switch to Informatics or add a Data Science minor, how much more work is it — exactly?"*
- *"Is this professor any good, what's the grade distribution, and are there seats left this quarter?"*
- *"Do these two classes conflict, and can I actually finish on time?"*

---

## ✨ Highlights

**Degree audit that's actually exact.**
Your DARS audit is imported automatically and rendered as a live progress card and a full per-requirement breakdown — earned / in-progress / remaining, GPA, and every unmet requirement with the courses that satisfy it.

**Compare majors & minors side by side.**
Line up any programs and see every requirement. Programs you've run through DARS are marked ✓ **exact** with real per-category numbers and specific required courses; everything else is a transcript estimate until you run its audit. Auto-run DARS across a whole batch in the background. When you add a minor, requirements are tagged **Major / Minor / Both** so you always know what counts for what.

**A recommendation model built around what you still need.**
The gen-ed course picker ranks courses by how much of your *remaining* requirements each one covers — a course that fills three areas you still need beats one that only double-counts areas you've finished. Full-screen, searchable, and filterable by area and credits.

**Course details with real data.**
Open any course for its DawgPath grade distribution (tap a bar for the exact % who earned each grade), professor ratings pulled live from RateMyProfessors, and — for the current and next quarter — every lecture and quiz section with meeting times and **live open-seat counts**, plus clash detection so you don't plan two classes at the same time.

**A plan board that respects the UW calendar.**
Timeline and grid views, drag-and-drop courses across quarters, prerequisite awareness, and correct academic-year labeling (Summer → Spring). Plan quarters years into the future.

**Make it yours.**
Seven wallpaper themes (Tahoe, Goa, Sequoia, Tea Gardens, Golden Gate, Ganges) with live video backgrounds that shift with the time of day, adjustable liquid-glass blur and background dim, widget toggles, and a live/still switch to save battery.

---

## 🧩 How it works

Liquid is three pieces that work together:

```
┌──────────────────┐     signed-in UW session      ┌───────────────────────┐
│  Chrome extension │ ───────────────────────────▶ │  MyPlan · DARS ·      │
│  (MV3)            │  reads audits, catalog,       │  DawgPath · RateMyProf │
│                   │  course + section data        └───────────────────────┘
└────────┬─────────┘
         │ POST (your JWT)
         ▼
┌──────────────────┐        REST + JWT auth        ┌───────────────────────┐
│  Express backend  │ ◀──────────────────────────▶ │  React (Vite) web app  │
│  + Firestore      │   snapshots, plans, catalog   │  the liquid-glass UI   │
└──────────────────┘                               └───────────────────────┘
```

- **The web app** is the interface — the plan board, audit, compare, course details, and settings. It never touches university systems directly.
- **The browser extension** runs on the user's own logged-in UW tabs. It reads the DARS audit, scrapes the program and course catalog, and fetches per-course details (grades, professors, sections, seats) using the student's existing session, then hands the data to the backend. It never asks for a NetID, password, or 2FA, and never forges university request signatures.
- **The backend** stores each user's plan and their per-program DARS snapshots, serves the shared course catalog, and manages the auto-audit queue the extension drains in the background.

Deep dives live in [`/docs`](./docs): [Architecture](./docs/ARCHITECTURE.md) · [Extension](./docs/EXTENSION.md) · [Auth](./docs/AUTH.md) · [Firestore](./docs/FIRESTORE.md) · [Hosting](./docs/HOSTING.md) · [Integration](./docs/INTEGRATION.md) · [Production](./docs/PRODUCTION.md).

---

## 🛠️ Tech stack

| Layer | Tech |
|-------|------|
| **Web app** | React 18, Vite, plain CSS (custom liquid-glass design system) |
| **Backend** | Node.js, Express, Firestore, JWT auth (NetID SSO / dev login) |
| **Extension** | Chrome Manifest V3 (service worker + content scripts) |
| **Hosting** | Web app on Vercel · API on Render |
| **Data sources** | UW MyPlan, DARS, DawgPath, RateMyProfessors |

---

## 📁 Repository layout

```
Course/
├── web-app/            # React + Vite front end (the UI)
│   ├── src/            # App.jsx, recommend.js, data.js, api.js, styles.css
│   └── public/themes/  # compressed video/image theme backgrounds
├── server/             # Express + Firestore backend
│   └── src/            # index.js (routes), dars.js (DARS parser), store.js
├── extension/          # Chrome MV3 extension
│   ├── background.js   # service worker (audits, catalog, course details)
│   ├── content-dars.js # runs on the DARS audit page
│   └── content-app.js  # bridges the web app ↔ extension
├── docs/               # architecture, auth, hosting, integration guides
└── compress-backgrounds.sh   # builds the theme videos from source wallpapers
```

---

## 🚀 Getting started (local dev)

**Prerequisites:** Node 18+, and (optionally) a Firestore project. Without one the backend falls back to an in-memory store for local testing.

```bash
# 1) Backend
cd server
npm install
npm run dev            # http://localhost:8787

# 2) Web app
cd ../web-app
npm install
npm run dev            # http://localhost:5173  (Vite)

# 3) Extension (Chrome)
#    chrome://extensions → enable Developer mode →
#    "Load unpacked" → select the  extension/  folder
```

Point the web app at your backend with `VITE_API_URL` (defaults to `http://localhost:8787`). Sign in, open a MyPlan DARS audit with the extension enabled, and your real data flows in.

**Build for production:**

```bash
cd web-app && npm run build     # outputs to  web-app/siteV/  (extension is bundled in automatically)
```

---

## 🔒 Privacy

Liquid reads a signed-in student's *own* university data, on their own machine, to show it back to them. It never handles NetID credentials or passwords, never bypasses university bot protections or request signing, and only sends data to the student's own Liquid account. The full course catalog is published once by the maintainer and shared read-only, so individual users never have to scrape anything themselves.

---

## 🗺️ Roadmap

- Fused **major + minor** DARS view — merge both real audits into one requirement tree with de-duplicated overlapping courses and source tags.
- Section selection stored per plan item, with full cross-quarter conflict checking.
- Exhaustive live section/seat data across more terms.

---

<div align="center">

**Liquid** — because planning your degree should feel like calm water, not twelve open tabs.

*Not affiliated with or endorsed by the University of Washington.*

</div>
