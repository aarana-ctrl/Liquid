# Liquid Planner — Web App

A college course planner with a liquid-glass / floating-island theme. Pick a major, connect your school ID to pull completed courses, and see a personalized planner of what's left, prerequisites, and pathways.

## Run it

**Quickest:** open `dist/index.html` in a browser (already built).

**Dev mode (live reload):**

```bash
cd web-app
npm install
npm run dev      # http://localhost:5173
npm run build    # regenerates dist/
```

## What's in this version

- Major picker → loads that degree's required courses (UW Computer Science is the full sample dataset; Informatics and Data Science are stubs).
- Mock school-server API (`fetchCompletedCourses` in `src/data.js`) that simulates signing in with a school ID and pulling transcript data.
- Two planner views you can toggle: a **prereq pathway graph** (courses laid out by prerequisite depth with connecting arrows) and a **semester grid** (courses by year).
- Color-coded status: completed, available now, prereqs pending — plus progress stats and a "still needed" list.

## Structure

- `src/data.js` — universities, majors, courses + prereqs, and the mock API. Swap this for real catalog/SIS API calls.
- `src/App.jsx` — app logic, status computation, graph layout.
- `src/styles.css` — liquid-glass theme.

## Roadmap (next versions)

Real catalog scraping from university sites, transcript OAuth, minors / double majors, term-by-term planning, and **real-time sync with the companion SwiftUI iOS app**.
