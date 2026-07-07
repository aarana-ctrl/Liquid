// Service worker: stores the app session (token + API base) picked up from the
// logged-in web app, performs the authenticated DARS import, and can test the
// connection. A manual `apiOverride` (set in the popup) always wins over the
// API base the web app reported — so the extension works even if the deployed
// site was built pointing at the wrong backend.

// The single hidden tab used to run queued DARS audits, and its safety timer.
let bgAuditTabId = null, bgCloseTimer = null;
function closeBgTab() {
  if (bgCloseTimer) { clearTimeout(bgCloseTimer); bgCloseTimer = null; }
  if (bgAuditTabId != null) { chrome.tabs.remove(bgAuditTabId).catch(() => {}); bgAuditTabId = null; }
}

function baseUrl(s) { return (s.apiOverride || s.api || "").replace(/\/$/, ""); }

async function readStore() {
  return new Promise((r) => chrome.storage.local.get(["token", "api", "apiOverride"], r));
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "lp-auth") {
    chrome.storage.local.set({ token: msg.token, api: msg.api }, () => sendResponse({ ok: true }));
    return true;
  }

  if (msg?.type === "lp-set-api") {
    chrome.storage.local.set({ apiOverride: (msg.api || "").trim() }, () => sendResponse({ ok: true }));
    return true;
  }

  if (msg?.type === "lp-status") {
    readStore().then((s) => sendResponse({ connected: !!(s.token && baseUrl(s)), api: baseUrl(s), override: s.apiOverride || "" }));
    return true;
  }

  // Diagnostic: is the backend reachable, and is our token valid?
  if (msg?.type === "lp-test") {
    (async () => {
      const s = await readStore();
      const api = baseUrl(s);
      if (!api) return sendResponse({ ok: false, stage: "config", detail: "No backend URL. Open Liquid and sign in, or set the backend URL below." });
      try {
        const h = await fetch(api + "/health");
        if (!h.ok) return sendResponse({ ok: false, stage: "health", detail: `Backend returned ${h.status}` });
      } catch (e) {
        return sendResponse({ ok: false, stage: "health", detail: `Can't reach ${api} (${String(e.message || e)})` });
      }
      if (!s.token) return sendResponse({ ok: false, stage: "auth", detail: "Backend is up, but you're not signed in. Open Liquid and sign in." });
      try {
        const me = await fetch(api + "/api/me", { headers: { Authorization: "Bearer " + s.token } });
        if (me.ok) { const j = await me.json().catch(() => ({})); return sendResponse({ ok: true, api, who: j.user?.email || j.email || "signed in" }); }
        return sendResponse({ ok: false, stage: "auth", detail: `Signed-in check failed (${me.status}). Sign in to Liquid again.` });
      } catch (e) {
        return sendResponse({ ok: false, stage: "auth", detail: String(e.message || e) });
      }
    })();
    return true;
  }

  // Run the audit queue in ONE hidden background tab that closes itself when
  // done. Reuses an already-open MyPlan tab if there is one (and never closes
  // the user's own tab). Only ever one background tab, no matter how many times
  // this is called — so 10 programs never means 10 tabs.
  // lp-run-queue-bg (from the app) and lp-check-queue (extension's own poll) both
  // land here: if there's anything queued, run it in ONE hidden tab that closes
  // itself. Checks the queue FIRST so it never opens a tab for nothing.
  if (msg?.type === "lp-run-queue-bg" || msg?.type === "lp-check-queue") {
    (async () => {
      const s = await readStore();
      if (!s.token || !baseUrl(s)) { sendResponse({ ok: false, error: "not-connected" }); return; }
      try {
        const qr = await fetch(baseUrl(s) + "/api/audit-queue", { headers: { Authorization: "Bearer " + s.token } });
        const qj = await qr.json().catch(() => ({}));
        if (!qj.queue || !qj.queue.length) { sendResponse({ ok: true, empty: true }); return; }
        // A MyPlan tab the user already has open? Use it; don't open/close a tab.
        const existing = await chrome.tabs.query({ url: "https://myplan.uw.edu/audit*" });
        if (existing && existing.length) {
          existing.forEach((t) => chrome.tabs.sendMessage(t.id, { type: "lp-run-queue" }));
          sendResponse({ ok: true, reused: true }); return;
        }
        // Our hidden tab is already working — re-trigger it, don't open another.
        if (bgAuditTabId != null) {
          chrome.tabs.sendMessage(bgAuditTabId, { type: "lp-run-queue" });
          sendResponse({ ok: true, busy: true }); return;
        }
        const tab = await chrome.tabs.create({ url: "https://myplan.uw.edu/audit/#/degree", active: false });
        bgAuditTabId = tab.id;
        bgCloseTimer = setTimeout(closeBgTab, 900000); // safety net: close after 15 min (several audits in a throttled background tab take a while)
        // If the UW session is expired, the audit URL redirects to WebLogin — the
        // audit can't run, so close the tab early (the app surfaces a re-login prompt).
        setTimeout(async () => {
          try { const t = bgAuditTabId != null ? await chrome.tabs.get(bgAuditTabId) : null;
            if (t && t.url && !/myplan\.uw\.edu\/audit/i.test(t.url)) closeBgTab();
          } catch { /* */ }
        }, 9000);
        sendResponse({ ok: true, opened: true });
      } catch (e) { sendResponse({ ok: false, error: String(e.message || e) }); }
    })();
    return true;
  }

  // The content script reports the queue is drained — close our hidden tab
  // promptly (only if it's the one WE opened; never the user's own tab).
  if (msg?.type === "lp-queue-processed") {
    if (_sender?.tab?.id != null && _sender.tab.id === bgAuditTabId) closeBgTab();
    return false;
  }

  // Full course details: DawgPath (grades/info) + MyPlan sections (instructors,
  // times) + RateMyProfessors ratings for each instructor. Uses the UW session.
  if (msg?.type === "lp-course-details") {
    (async () => {
      const id = encodeURIComponent(String(msg.courseId || "").replace(/([A-Z])(\d)/, "$1 $2"));
      const data = {};
      // 1) DawgPath — grade distribution + description
      try {
        const r = await fetch("https://dawgpath.uw.edu/api/v1/courses/details/" + id, { credentials: "include" });
        if (r.ok) { const d = await r.json(); Object.assign(data, {
          courseId: d.course_id, title: d.course_title, credits: d.course_credits,
          description: d.course_description, offered: d.course_offered, prereq: d.prereq_string,
          gpaDistro: d.gpa_distro || [], concurrent: d.concurrent_courses || [] }); }
      } catch (e) { /* */ }
      // 2) MyPlan — sections with instructors, meeting times, and live seats.
      // MyPlan returns up to two terms (the current + next quarter) — expose both
      // so the app can show timings + seats for the quarters you can plan.
      let profNames = [];
      try {
        const r = await fetch("https://course-app-api.planning.sis.uw.edu/api/courses/" + id + "/details", { credentials: "include" });
        if (r.ok) {
          const d = await r.json();
          const inst = d.courseOfferingInstitutionList && d.courseOfferingInstitutionList[0];
          const termList = (inst && inst.courseOfferingTermList) || [];
          const mapSec = (s) => ({
            code: s.code,
            type: (s.activityOfferingType || "").toLowerCase(), // lecture | quiz | lab | studio
            primary: !!s.primary,
            linkTo: s.primaryActivityOfferingCode || null,       // quiz/lab → its lecture code
            instructor: (s.instructor || "").trim(),
            sln: s.registrationCode || null,
            seats: { count: s.enrollCount, max: s.enrollMaximum, status: (s.enrollStatus || "").toLowerCase() },
            meetings: (s.meetingDetailsList || []).map((m) => ({ days: m.days || "", time: m.time || "", building: m.building || "", room: m.room || "" })),
            meet: (s.meetingDetailsList || []).map((m) => `${m.days || ""} ${m.time || ""}${m.building ? " · " + m.building + " " + (m.room || "") : ""}`.trim()),
          });
          data.terms = termList.slice(0, 2).map((t) => ({
            term: t.term || "",                 // e.g. "Autumn 2026"
            qtr: t.qtryr || (t.activityOfferingItemList && t.activityOfferingItemList[0] && t.activityOfferingItemList[0].qtryr) || "",
            sections: (t.activityOfferingItemList || []).map(mapSec),
          }));
          // Backward-compatible fields from the first (current) term.
          const t0 = termList[0];
          data.term = (t0 && t0.term) || "";
          const lects0 = ((t0 && t0.activityOfferingItemList) || []).filter((s) => s.instructor && s.instructor.trim() && /lecture/i.test(s.activityOfferingType || ""));
          data.sections = lects0.map(mapSec);
          profNames = [...new Set(lects0.map((s) => s.instructor.trim()))];
        }
      } catch (e) { /* */ }
      // 3) RateMyProfessors — real ratings per instructor (UW schoolID)
      const profs = [];
      for (const name of profNames) {
        const parts = name.trim().split(/\s+/);
        const last = parts[parts.length - 1], first = (parts[0] || "").toLowerCase();
        try {
          const q = { query: `query{ newSearch{ teachers(query:{text:"${last}", schoolID:"U2Nob29sLTE1MzA="}){ edges{ node{ firstName lastName avgRating numRatings avgDifficulty legacyId } } } } }` };
          const r = await fetch("https://www.ratemyprofessors.com/graphql", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Basic dGVzdDp0ZXN0" }, body: JSON.stringify(q) });
          const j = await r.json();
          const edges = (j && j.data && j.data.newSearch && j.data.newSearch.teachers && j.data.newSearch.teachers.edges) || [];
          const m = edges.find((e) => e.node.firstName.toLowerCase().slice(0, 4) === first.slice(0, 4)) || edges[0];
          if (m && m.node) profs.push({ name, rating: m.node.avgRating, numRatings: m.node.numRatings, difficulty: m.node.avgDifficulty, legacyId: m.node.legacyId, found: (m.node.numRatings || 0) > 0 });
          else profs.push({ name, found: false });
        } catch (e) { profs.push({ name, found: false }); }
      }
      data.professors = profs;
      sendResponse({ ok: true, data });
    })();
    return true;
  }

  if (msg?.type === "lp-catalog") {
    (async () => {
      const s = await readStore();
      const api = baseUrl(s);
      if (!s.token || !api) return sendResponse({ ok: false, error: "not-connected" });
      try {
        const r = await fetch(api + "/api/programs", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.token }, body: JSON.stringify({ majors: msg.majors, minors: msg.minors }) });
        sendResponse({ ok: r.ok });
      } catch (e) { sendResponse({ ok: false, error: String(e.message || e) }); }
    })();
    return true;
  }

  if (msg?.type === "lp-queue") {
    (async () => {
      const s = await readStore();
      const api = baseUrl(s);
      if (!s.token || !api) return sendResponse({ ok: false, error: "not-connected" });
      try {
        const r = await fetch(api + "/api/audit-queue", { headers: { Authorization: "Bearer " + s.token } });
        const j = await r.json().catch(() => ({}));
        sendResponse({ ok: r.ok, queue: j.queue || [] });
      } catch (e) { sendResponse({ ok: false, error: String(e.message || e) }); }
    })();
    return true;
  }

  if (msg?.type === "lp-queue-done") {
    (async () => {
      const s = await readStore();
      const api = baseUrl(s);
      if (!s.token || !api) return sendResponse({ ok: false });
      try {
        await fetch(api + "/api/audit-queue/done", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.token }, body: JSON.stringify({ name: msg.name }) });
        sendResponse({ ok: true });
      } catch { sendResponse({ ok: false }); }
    })();
    return true;
  }

  if (msg?.type === "lp-scrape-status") {
    (async () => {
      // Is the MyPlan session alive (so a scrape will actually work)?
      try {
        const r = await fetch("https://course-app-api.planning.sis.uw.edu/api/session", { credentials: "include" });
        const j = await r.json().catch(() => ({}));
        sendResponse({ ok: r.ok && !!(j.user && j.user.userName), user: j.user && j.user.userName });
      } catch (e) { sendResponse({ ok: false, error: String(e.message || e) }); }
    })();
    return true;
  }

  if (msg?.type === "lp-import") {
    (async () => {
      const s = await readStore();
      const api = baseUrl(s);
      if (!s.token || !api) { sendResponse({ ok: false, error: "not-connected" }); return; }
      try {
        const r = await fetch(api + "/api/import/dars", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.token },
          body: JSON.stringify({ darsText: msg.darsText }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok) sendResponse({ ok: true, result: j });
        else sendResponse({ ok: false, status: r.status, detail: j.error || r.statusText, api });
      } catch (e) {
        sendResponse({ ok: false, error: "fetch", detail: String(e.message || e), api });
      }
    })();
    return true; // async
  }
});

// ---- Full catalog scrape ---------------------------------------------------
// Streams progress over a Port (keeps the service worker alive). Walks every
// Seattle subject area, runs the same authenticated course search MyPlan itself
// uses (the student's own session), normalizes each course to a tiny record,
// and uploads to the backend in chunks. Never opens a tab.
const GE_MAP = { "A&H": "arts", "SSc": "social", "NSc": "science", "DIV": "diversity", "W": "writing", "C": "writing", "RSN": "quant" };

async function scrapeAllCourses(port) {
  const s = await readStore();
  const api = baseUrl(s);
  if (!s.token || !api) { port.postMessage({ type: "error", error: "not-connected" }); return; }
  const B = "https://course-app-api.planning.sis.uw.edu/api";
  // 1) session (csrf + app checksum + netid). If missing, the UW session is dead.
  let sess;
  try { sess = await (await fetch(B + "/session", { credentials: "include" })).json(); } catch (e) { /* */ }
  if (!sess || !sess.csrf || !(sess.user && sess.user.userName)) { port.postMessage({ type: "error", error: "myplan-login" }); return; }
  const H = { "Content-Type": "application/json", "x-csrf-token": sess.csrf, "x-sis-api-checksum": sess.application && sess.application.checksum };
  const uname = sess.user.userName;
  // 2) all subject areas
  let subs = [];
  try { subs = await (await fetch(B + "/subjectAreas", { credentials: "include" })).json(); } catch (e) { /* */ }
  subs = (subs || []).filter((x) => x.campus === "seattle");
  if (!subs.length) { port.postMessage({ type: "error", error: "no-subjects" }); return; }
  const seen = new Set();
  const out = [];
  const total = subs.length;
  for (let i = 0; i < subs.length; i++) {
    const sa = subs[i];
    try {
      const body = JSON.stringify({ username: uname, requestId: (crypto.randomUUID ? crypto.randomUUID() : "r" + Date.now() + i), sectionSearch: true, instructorSearch: false, queryString: sa.code, consumerLevel: "UNDERGRADUATE", campus: "seattle", days: [], startTime: "0630", endTime: "2230" });
      const r = await fetch(B + "/courses", { method: "POST", credentials: "include", headers: H, body });
      if (r.ok) {
        const list = await r.json();
        for (const c of (list || [])) {
          const id = String(c.code || "").trim();
          if (!id || seen.has(id)) continue;
          seen.add(id);
          const g = [...new Set((c.genEduReqs || []).map((x) => GE_MAP[x]).filter(Boolean))];
          out.push({ i: id, t: c.title || "", c: (+(c.credit || (c.allCredits && c.allCredits[0]) || 0)) || 0, g, l: (+(c.level || 0)) || 0, s: sa.code });
        }
      } else if (r.status === 401 || r.status === 403) {
        port.postMessage({ type: "error", error: "myplan-login" }); return;
      }
    } catch (e) { /* skip this subject */ }
    port.postMessage({ type: "progress", phase: "scan", done: i + 1, total, count: out.length, subject: sa.code });
    await new Promise((res) => setTimeout(res, 100)); // be gentle
  }
  // 3) upload in chunks + finalize
  const CH = 500;
  const chunks = Math.ceil(out.length / CH) || 0;
  for (let i = 0; i < chunks; i++) {
    try {
      await fetch(api + "/api/courses-catalog", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.token }, body: JSON.stringify({ chunk: i, courses: out.slice(i * CH, (i + 1) * CH) }) });
    } catch (e) { /* */ }
    port.postMessage({ type: "progress", phase: "upload", done: i + 1, total: chunks, count: out.length });
  }
  try {
    await fetch(api + "/api/courses-catalog", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.token }, body: JSON.stringify({ done: true, chunks }) });
  } catch (e) { /* */ }
  port.postMessage({ type: "finished", count: out.length, chunks });
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "lp-scrape") return;
  scrapeAllCourses(port).catch((e) => { try { port.postMessage({ type: "error", error: String(e.message || e) }); } catch (_) { /* */ } });
});
