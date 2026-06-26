# MyPlan Integration — connect & pull

How the planner gets real UW data. There is **no standalone scraper** and no stored credentials. The student logs in themselves; the app reads their already-authenticated session. This is a one-time-per-session import.

## The flow

1. **User logs in.** In Chrome (or any Chromium browser — Edge/Brave/Opera; Safari is not supported by the extension), the student signs into `myplan.uw.edu` with their NetID + 2FA. Claude never sees or enters credentials.
2. **Connect the browser.** With the Claude in Chrome extension installed, the student clicks *Connect*. Claude can now read pages in that session.
3. **Read the audit (progress).** Navigate to `https://myplan.uw.edu/audit/#/degree` (the DARS degree audit) and extract the page text. This yields: program + catalog year, GPA, total credits earned / in-progress / needed, and every requirement block with its completed and in-progress courses (English Comp, Writing, Diversity, Areas of Inquiry A&H/SSc/NSc, Math, CSE Fundamentals, CSE Core & Electives).
4. **Read the course search (options).** For each unmet category, use `https://myplan.uw.edu/course` with the General-Education filters (`A&H`, `SSc`, `NSc`, `DIV`, `W`, …) to list qualifying, currently-offered courses.
5. **Merge into one model.** The audit fills progress + completed courses; the search fills the per-category "courses you could take." Both load into this app (`STUDENT_SNAPSHOT` + `COURSES` in `src/data.js`).

## Two UW systems, one view

| UW system | URL | What we take |
|---|---|---|
| DARS degree audit | `myplan.uw.edu/audit/#/degree` | progress, completed/IP courses, remaining by category |
| MyPlan course search | `myplan.uw.edu/course` | qualifying courses per requirement (with Gen-Ed filters) |
| MyPlan planner | `myplan.uw.edu/audit/#/plan` | (future) write planned courses back |

## Real snapshot captured

This session pulled a live snapshot for the signed-in student (BS Computer Science, catalog AU 25): **76 credits earned, 13 in progress, 91 needed, GPA 3.18**. Highlights the app now reflects: Natural Sciences satisfied; Social Sciences 15/20; **Arts & Humanities 0/20 (biggest gap)**; Writing needs 5 more (ESS 101 in progress); Diversity needs 5; CSE Fundamentals still needs CSE 312 and CSE 332; CSE Core & Electives needs 33 credits. Raw values are in `student-snapshot.json`.

## Notes & limits

- **Re-run each session.** Because there's no stored login, importing is a fresh connect-and-read each time — by design.
- **Reading, not writing.** We only read. Writing courses back into MyPlan's planner is a future, opt-in step.
- **Privacy.** The DARS page itself notes federal law prohibits transmittal to third parties; data stays in this local app and is not sent anywhere.
- **Parsing.** DARS text is stable but advising-tool output — final degree confirmation is always subject to department/college approval, as the audit states.
