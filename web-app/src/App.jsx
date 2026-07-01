import React, { useMemo, useState, useEffect, useRef, useLayoutEffect } from "react";
import { UNIVERSITY, MAJORS, COURSES, CATEGORY_LABELS, fetchMyPlanSnapshot, parseTranscript } from "./data.js";
import { mockSignIn } from "./auth.js";
import { apiHealth, devLogin, getPlan, savePlan, getSnapshot, postSnapshot, startImport, importDars, me, oidcStartUrl, API_BASE } from "./api.js";
import { MINORS, MAJOR_CATALOG, buildProgram, resolveProgram } from "./data.js";
import { recommend, poolForArea, computeRemaining, autoSelect } from "./recommend.js";
import bgUrl from "./bg.jpg";

// ---- quarter calendar (UW: Autumn, Winter, Spring, Summer) ------------------
// Chronological order within a calendar year: Winter < Spring < Summer < Autumn.
// A quarter is identified by an absolute index = year*4 + termOrder.
const TERM_NAME = { AU: "Autumn", WI: "Winter", SP: "Spring", SU: "Summer" };
const TERM_ORDER = { WI: 0, SP: 1, SU: 2, AU: 3 };
const ORDER_TERM = ["WI", "SP", "SU", "AU"];
const qAbs = (term, year) => year * 4 + TERM_ORDER[term];
const absToQ = (abs) => ({ term: ORDER_TERM[((abs % 4) + 4) % 4], year: Math.floor(abs / 4) });
const qLabelAbs = (abs) => { const q = absToQ(abs); return `${TERM_NAME[q.term]} ${q.year}`; };
const qShort = (abs) => { const q = absToQ(abs); return `${q.term}${String(q.year).slice(2)}`; };
function parseQ(code) {
  const m = /^([A-Z]{2})(\d{2})$/.exec((code || "").toUpperCase());
  if (!m || TERM_ORDER[m[1]] == null) return null;
  return qAbs(m[1], 2000 + +m[2]);
}
function currentAbs() {
  const d = new Date(), mo = d.getMonth() + 1, y = d.getFullYear();
  // UW: Winter Jan–Feb, Spring Mar–May, Summer Jun–Aug, Autumn Sep–Dec
  const term = mo <= 2 ? "WI" : mo <= 5 ? "SP" : mo <= 8 ? "SU" : "AU";
  return qAbs(term, y);
}
// next `n` quarters from startAbs; optionally skip summers (for auto-plan loads)
function nextQuarters(startAbs, n, includeSummer) {
  const out = []; let a = startAbs;
  while (out.length < n) { if (includeSummer || absToQ(a).term !== "SU") out.push(a); a++; }
  return out;
}
// "Current" quarter = the quarter of the in-progress courses if any (that's what
// the student is doing now per their registration); otherwise the wall clock.
function effectiveCurrentAbs(ipSet, courseTerms) {
  const ip = [...ipSet].map((id) => parseQ(courseTerms[id])).filter((a) => a != null);
  return ip.length ? Math.max(...ip) : currentAbs();
}
const CAT_VAR = {
  intro: "var(--cat-intro)", math: "var(--cat-math)", core: "var(--cat-core)", core400: "var(--cat-core400)",
  science: "var(--cat-science)", arts: "var(--cat-arts)", social: "var(--cat-social)", english: "var(--cat-english)", diversity: "var(--cat-diversity)",
};

// ---- plan helpers ----------------------------------------------------------
function buildPlanIds(major, completedSet, ipSet, chosenSet) {
  const ids = new Set();
  major.requirements.forEach((r) => { if (r.kind === "all") r.courses.forEach((id) => ids.add(id)); });
  chosenSet.forEach((id) => ids.add(id));
  completedSet.forEach((id) => { if (COURSES[id]) ids.add(id); });
  ipSet.forEach((id) => { if (COURSES[id]) ids.add(id); });
  return ids;
}
function statusOf(id, completedSet, ipSet, planIds) {
  if (completedSet.has(id)) return "done";
  if (ipSet.has(id)) return "ip";
  const prereqs = (COURSES[id].prereqs || []).filter((p) => planIds.has(p));
  return prereqs.every((p) => completedSet.has(p) || ipSet.has(p)) ? "avail" : "locked";
}
function depthFn(planIds) {
  const cache = {};
  const d = (id, seen = new Set()) => {
    if (cache[id] != null) return cache[id];
    if (seen.has(id)) return 0; seen.add(id);
    const ps = (COURSES[id].prereqs || []).filter((p) => planIds.has(p));
    const v = ps.length === 0 ? 0 : 1 + Math.max(...ps.map((p) => d(p, seen)));
    cache[id] = v; return v;
  };
  return d;
}
// Spread remaining (non-completed, non-in-progress) courses across UPCOMING
// quarters (starting the quarter after the current one, skipping summers),
// respecting prerequisites and a ~15 cr/quarter target. Returns id -> absIndex.
function scheduleAll(planIds, completedSet, ipSet) {
  const remaining = [...planIds].filter((id) => !completedSet.has(id) && !ipSet.has(id));
  const depth = depthFn(planIds);
  const satisfied = new Set([...completedSet, ...ipSet]);
  const order = [...remaining].sort((a, b) => depth(a) - depth(b) || COURSES[b].credits - COURSES[a].credits);
  const quarters = nextQuarters(currentAbs() + 1, 16, false); // 16 non-summer quarters of runway
  const load = {}; quarters.forEach((q) => (load[q] = 0));
  const placed = {}; const target = 15;
  order.forEach((id) => {
    // earliest quarter index allowed by prerequisites
    let minSlot = 0;
    (COURSES[id].prereqs || []).filter((p) => planIds.has(p)).forEach((p) => {
      if (satisfied.has(p)) return;
      if (placed[p] != null) { const s = quarters.indexOf(placed[p]); if (s >= 0) minSlot = Math.max(minSlot, s + 1); }
    });
    let s = minSlot;
    while (s < quarters.length - 1 && load[quarters[s]] + COURSES[id].credits > target && load[quarters[s]] >= target - 3) s++;
    if (s >= quarters.length) s = quarters.length - 1;
    placed[id] = quarters[s]; load[quarters[s]] += COURSES[id].credits;
  });
  return placed;
}

// ---- inline icons ----------------------------------------------------------
const I = {
  home: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>,
  search: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>,
  user: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  grad: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 9l10-4 10 4-10 4z"/><path d="M6 11v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5"/></svg>,
  spark: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.5L19 9l-5.2 1.5L12 16l-1.8-5.5L5 9l5.2-1.5z"/></svg>,
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>,
  pen: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>,
  undo: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 7 4 12l5 5"/><path d="M4 12h11a5 5 0 0 1 0 10h-1"/></svg>,
  cal: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>,
  gear: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>,
};
const GoogleLogo = () => (<svg viewBox="0 0 48 48" width="18" height="18"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.9-9.9 6.9-17.4z"/><path fill="#FBBC05" d="M10.4 28.3c-.5-1.5-.8-3.1-.8-4.8s.3-3.3.8-4.8l-7.8-6.1C.9 16 0 19.9 0 24s.9 8 2.6 11.4z"/><path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.3-5.7c-2 1.4-4.7 2.3-7.9 2.3-6.3 0-11.7-3.7-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/></svg>);
const AppleLogo = () => (<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M16.37 12.62c.03 3.27 2.86 4.35 2.9 4.37-.02.08-.45 1.55-1.49 3.07-.9 1.31-1.83 2.61-3.3 2.64-1.44.03-1.9-.85-3.55-.85-1.64 0-2.16.82-3.52.88-1.42.05-2.5-1.42-3.41-2.72C.66 19.32-.74 14.46 1.2 11.18c.96-1.63 2.68-2.66 4.54-2.69 1.39-.03 2.7.94 3.55.94.85 0 2.44-1.16 4.11-.99.7.03 2.67.28 3.93 2.13-.1.06-2.35 1.37-2.33 4.09M13.6 5.34c.75-.91 1.26-2.18 1.12-3.44-1.08.04-2.39.72-3.17 1.63-.7.8-1.31 2.09-1.15 3.32 1.21.09 2.44-.61 3.2-1.51"/></svg>);

// ---- background: photo behind, faint drifting color, glass on top ----------
function Sky() {
  return (
    <>
      <div className="bg-photo" style={{ backgroundImage: `url(${bgUrl})` }} aria-hidden />
      <div className="bg-tint" aria-hidden />
      <div className="canvas" aria-hidden>
        <span className="blob b1" /><span className="blob b2" /><span className="blob b3" />
      </div>
    </>
  );
}

// ---- assistant orb + radial dial -------------------------------------------
function AssistantOrb({ open, onToggle, items }) {
  const N = items.length, start = 20, end = 160, R = 96; // fan downward (orb sits at top)
  return (
    <div className="orbwrap">
      {open && (
        <div className="dial">
          {items.map((it, i) => {
            const ang = ((N === 1 ? (start + end) / 2 : start + (i * (end - start)) / (N - 1)) * Math.PI) / 180;
            const dx = R * Math.cos(ang), dy = R * Math.sin(ang);
            return (
              <div key={it.key} className="dial-item" style={{ left: dx, top: dy, animationDelay: `${i * 0.03}s` }}
                onClick={() => { it.onClick(); onToggle(false); }}>
                <div className="dial-ic">{it.icon}</div><div className="dial-lbl">{it.label}</div>
              </div>
            );
          })}
        </div>
      )}
      <div className={`orb ${open ? "open" : ""}`} onClick={() => onToggle(!open)} title="Assistant" />
    </div>
  );
}

// ---- sign-in gate ----------------------------------------------------------
function Login({ onSignIn, backendOnline, oidcEnabled }) {
  const [busy, setBusy] = useState(null);
  async function go(p) { setBusy(p); const u = await mockSignIn(p); await onSignIn(u); }
  function google() { if (oidcEnabled.google) { setBusy("google"); window.location.href = oidcStartUrl("google"); } else go("google"); }
  function netid() { if (oidcEnabled.uw) { setBusy("netid"); window.location.href = oidcStartUrl("uw"); } else if (oidcEnabled.google) { setBusy("netid"); window.location.href = oidcStartUrl("google"); } else go("netid"); }
  const realSso = oidcEnabled.google || oidcEnabled.uw;
  return (
    <div className="login-wrap">
      <Sky />
      <div className="island login-card">
        <div className="login-logo" />
        <h1>Liquid Planner</h1>
        <p className="login-sub">Sign in with your UW email to load your degree audit.</p>
        <button className="prov google" disabled={!!busy} onClick={google}><GoogleLogo /><span>{busy === "google" ? "Redirecting…" : "Continue with Google"}</span></button>
        {!realSso && <button className="prov apple" disabled={!!busy} onClick={() => go("apple")}><AppleLogo /><span>{busy === "apple" ? "Signing in…" : "Continue with Apple"}</span></button>}
        <div className="login-or"><span>or</span></div>
        <button className="prov netid" disabled={!!busy} onClick={netid}>{busy === "netid" ? "Redirecting to UW…" : "Continue with UW NetID"}</button>
        <p className="login-note"><span className={`srv-dot ${backendOnline ? "on" : "off"}`} />
          {oidcEnabled.google
            ? "Sign in with your @uw.edu Google account — Google routes you to UW WebLogin (NetID + 2FA)."
            : backendOnline ? "Backend connected — your plan syncs across devices." : "Backend offline — running locally."}
          {!realSso && <><br />Demo sign-in (real OAuth wired for production — AUTH.md).</>}</p>
      </div>
    </div>
  );
}

// ---- plan board (central island) -------------------------------------------
function PlanBoard({ program, snapshot, planIds, completedSet, ipSet, courseTerms, schedule, setSchedule, mode, setMode }) {
  const boardRef = useRef(null), colsRef = useRef(null), cardRefs = useRef({}), curColRef = useRef(null);
  const [edges, setEdges] = useState([]);
  const [dragId, setDragId] = useState(null);
  const [catYear, setCatYear] = useState(snapshot?.catalogYear || "AU 25");
  const [pickAbs, setPickAbs] = useState(null); // grid "+" → pick a course for this quarter
  const cur = effectiveCurrentAbs(ipSet, courseTerms);

  // absolute quarter for a course (completed/in-progress use the real DARS term)
  const schedAbs = (id) => { const v = schedule[id]; return typeof v === "number" && v > 5000 ? v : null; }; // guard old index-format
  // AP / transfer (or term-less) completed credits aren't in a real quarter
  const isPre = (id) => completedSet.has(id) && (courseTerms[id] === "PRE" || !parseQ(courseTerms[id]));
  const getAbs = (id) => {
    if (isPre(id)) return null;
    if (completedSet.has(id)) return parseQ(courseTerms[id]);
    if (ipSet.has(id)) return parseQ(courseTerms[id]) ?? cur;
    return schedAbs(id);
  };
  const planArr = useMemo(() => [...planIds], [planIds]);
  const preCourses = planArr.filter(isPre);
  const remaining = planArr.filter((id) => !completedSet.has(id) && !ipSet.has(id));
  const pool = remaining.filter((id) => schedAbs(id) == null);

  // visible quarters: any quarter with courses + the current one + a future
  // non-summer runway. Empty PAST quarters are hidden; future summers show only
  // if they hold a course.
  const placedAbs = planArr.map(getAbs).filter((a) => a != null && a > cur - 24 && a < cur + 48);
  const maxAbs = Math.max(cur + 6, ...(placedAbs.length ? placedAbs : [cur]));
  const content = new Set(placedAbs);
  const visibleSet = new Set(content); visibleSet.add(cur);
  for (let a = cur; a <= maxAbs; a++) { const q = absToQ(a); if (q.term !== "SU") visibleSet.add(a); else if (content.has(a)) visibleSet.add(a); }
  const quarters = [...visibleSet].sort((x, y) => x - y);

  // academic-year grouping for the Grid view (Autumn Y … Summer Y+1)
  const groupYear = (abs) => { const q = absToQ(abs); return q.term === "AU" ? q.year : q.year - 1; };
  const _ays = new Set(placedAbs.map(groupYear)); _ays.add(groupYear(cur)); _ays.add(groupYear(cur) + 1);
  const academicYears = [..._ays].sort((a, b) => a - b);

  const contentOf = (abs) => planArr.filter((id) => getAbs(id) === abs)
    .sort((x, y) => (completedSet.has(y) - completedSet.has(x)) || (ipSet.has(y) - ipSet.has(x)));
  const creditsOf = (abs) => contentOf(abs).reduce((s, id) => s + COURSES[id].credits, 0);

  function violation(id) {
    const q = schedule[id]; if (q == null) return false;
    return (COURSES[id].prereqs || []).filter((p) => planIds.has(p)).some((p) => {
      if (completedSet.has(p) || ipSet.has(p)) return false;
      const pa = schedule[p]; return pa == null || pa >= q;
    });
  }

  const place = (id, abs) => { if (!completedSet.has(id) && !ipSet.has(id)) setSchedule((s) => ({ ...s, [id]: abs })); };
  const unplace = (id) => setSchedule((s) => { const n = { ...s }; delete n[id]; return n; });
  const drag = (id) => ({ draggable: true, onDragStart: () => setDragId(id), onDragEnd: () => setDragId(null) });
  const drop = (h) => ({ onDragOver: (e) => e.preventDefault(), onDrop: (e) => { e.preventDefault(); if (dragId) h(dragId); setDragId(null); } });

  // Connectors live INSIDE the scroll content (in content coordinates) so they
  // move with the cards — no recompute on scroll, no "random" redraw. We only
  // draw prerequisite → course links left-to-right (prereq in an earlier column).
  const SHOW_CONNECTORS = false; // hidden for now — declutters the timeline
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    if (!SHOW_CONNECTORS) { setEdges([]); return; }
    function compute() {
      const cols = colsRef.current; if (!cols) { setEdges([]); return; }
      const cr = cols.getBoundingClientRect();
      const ox = cr.left - cols.scrollLeft, oy = cr.top - cols.scrollTop; // content origin
      const out = [];
      planArr.forEach((id) => {
        const a = cardRefs.current[id]; if (!a) return;
        (COURSES[id].prereqs || []).filter((p) => planIds.has(p)).forEach((p) => {
          const b = cardRefs.current[p]; if (!b) return;
          const ar = a.getBoundingClientRect(), pr = b.getBoundingClientRect();
          const x1 = pr.right - ox, x2 = ar.left - ox;
          if (x1 >= x2 - 4) return; // only left-to-right (prereq earlier)
          out.push({ key: `${p}-${id}`, x1, y1: pr.top - oy + pr.height / 2, x2, y2: ar.top - oy + ar.height / 2 });
        });
      });
      setSvgSize({ w: cols.scrollWidth, h: cols.scrollHeight });
      setEdges(out);
    }
    compute();
    const ro = new ResizeObserver(compute); if (colsRef.current) ro.observe(colsRef.current);
    window.addEventListener("resize", compute);
    return () => { ro.disconnect(); window.removeEventListener("resize", compute); };
  }, [planArr.join(","), JSON.stringify(schedule), JSON.stringify(courseTerms), mode]);

  // center the current quarter on first render
  useEffect(() => {
    if (curColRef.current && colsRef.current) {
      const c = curColRef.current, parent = colsRef.current;
      parent.scrollLeft = c.offsetLeft - parent.clientWidth / 2 + c.clientWidth / 2;
    }
  }, []); // eslint-disable-line

  function card(id) {
    const done = completedSet.has(id), ip = ipSet.has(id), viol = violation(id);
    const cls = done ? "done" : ip ? "enrolled" : viol ? "locked violation" : "planned";
    const label = done ? "Completed" : ip ? "In progress" : viol ? "Prereq needed" : "Planned";
    const c = COURSES[id];
    return (
      <div key={id} ref={(el) => (cardRefs.current[id] = el)} className={`ccard ${cls}`}
        {...(done || ip ? {} : drag(id))} onClick={() => !done && !ip && unplace(id)} title={done || ip ? "From your transcript" : "Click to unschedule"}>
        <div className="ch"><span className="code">{id.replace(/([A-Z])(\d)/, "$1 $2")}</span><span className="cr">{c.credits}cr</span></div>
        <div className="ttl">{c.title}</div>
        <div className="st"><i />{label}</div>
        {viol && <div className="viol">⚠ prerequisite isn't earlier in your plan</div>}
      </div>
    );
  }

  return (
    <div className="island plan" ref={boardRef}>
      <div className="plan-head">
        <div className="plan-uni">
          <div className="uni-badge">W</div>
          <div><h3>{UNIVERSITY.name} ▾</h3><span>{program.name}</span></div>
        </div>
        <div className="plan-head-right">
          <select className="yearsel" value={catYear} onChange={(e) => setCatYear(e.target.value)} title="Catalog year">
            {["AU 22", "AU 23", "AU 24", "AU 25", "AU 26"].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="seg">
            <button className={mode !== "grid" ? "active" : ""} onClick={() => setMode("plan")}>Timeline</button>
            <button className={mode === "grid" ? "active" : ""} onClick={() => setMode("grid")}>Grid</button>
          </div>
        </div>
      </div>

      <div className="board">
        {mode === "grid" ? (
          <div className="grid-view">
            {preCourses.length > 0 && (
              <div className="grid-pre">
                <div className="grid-pre-head">Pre-credits · AP / Transfer <span>{preCourses.reduce((s, id) => s + COURSES[id].credits, 0)} cr</span></div>
                <div className="grid-pre-cards">{preCourses.map((id) => card(id))}</div>
              </div>
            )}
            <div className="grid-thead"><span /><span>Autumn</span><span>Winter</span><span>Spring</span><span>Summer</span></div>
            {academicYears.map((yr) => (
              <div className="grid-row" key={yr}>
                <div className="grid-ylabel">{yr}–{String(yr + 1).slice(2)}</div>
                {[["AU", yr], ["WI", yr + 1], ["SP", yr + 1], ["SU", yr + 1]].map(([t, y]) => {
                  const abs = qAbs(t, y); const list = contentOf(abs);
                  return (
                    <div key={t} className={`grid-cell ${abs === cur ? "cur" : ""}`} {...drop((id) => place(id, abs))}>
                      {list.map((id) => card(id))}
                      <button className="grid-add" onClick={() => setPickAbs(abs)} title="Add a course to this quarter">＋ add course</button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
        <div className="cols" ref={colsRef}>
          {SHOW_CONNECTORS && (
            <svg className="connectors" width={svgSize.w} height={svgSize.h} style={{ width: svgSize.w, height: svgSize.h }}>
              {edges.map((e) => { const mx = (e.x1 + e.x2) / 2;
                return <path key={e.key} className="conn" pathLength="1"
                  d={`M ${e.x1} ${e.y1} C ${mx} ${e.y1}, ${mx} ${e.y2}, ${e.x2} ${e.y2}`}
                  fill="none" stroke="url(#connGrad)" strokeWidth="1.6" />; })}
              <defs><linearGradient id="connGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="rgba(95,208,168,0.7)" /><stop offset="1" stopColor="rgba(139,123,240,0.7)" />
              </linearGradient></defs>
            </svg>
          )}
          {preCourses.length > 0 && (
            <div className="qcol qcol-pre">
              <div className="qcol-head"><h4>Pre-credits</h4><span className="cr">{preCourses.reduce((s, id) => s + COURSES[id].credits, 0)} cr</span></div>
              <div className="qcol-tag">AP / Transfer</div>
              <div className="qcol-line" />
              {preCourses.map((id) => card(id))}
            </div>
          )}
          {quarters.map((abs) => {
            const isCur = abs === cur, isPast = abs < cur;
            const tag = isCur ? "This quarter" : isPast ? "Completed" : "Upcoming";
            const list = contentOf(abs);
            return (
              <div key={abs} ref={isCur ? curColRef : null} className={`qcol ${isCur ? "qcol-cur" : ""}`} {...drop((id) => place(id, abs))}>
                <div className="qcol-head"><h4>{qLabelAbs(abs)}</h4><span className="cr">{creditsOf(abs)} cr</span></div>
                <div className="qcol-tag">{tag}</div>
                <div className="qcol-line" />
                {list.map((id) => card(id))}
                {list.length === 0 && <div className="empty">{isPast ? "—" : "drop course"}</div>}
              </div>
            );
          })}
          {pool.length > 0 && (
            <div className="qcol qcol-pool" {...drop(unplace)}>
              <div className="qcol-head"><h4>Unscheduled</h4><span className="cr">{pool.length}</span></div>
              <div className="qcol-tag">To place</div>
              <div className="qcol-line" style={{ background: "linear-gradient(90deg, var(--text-faint), transparent)" }} />
              {pool.map((id) => card(id))}
            </div>
          )}
        </div>
        )}
      </div>

      {pickAbs != null && (
        <div className="cd-overlay" onClick={() => setPickAbs(null)}>
          <div className="island cd-card" onClick={(e) => e.stopPropagation()}>
            <div className="cd-head">
              <div><div className="cd-title">Add to {qLabelAbs(pickAbs)}</div><div className="cd-sub">Pick a course — we check prerequisites for this quarter.</div></div>
              <button className="cd-close" onClick={() => setPickAbs(null)}>×</button>
            </div>
            <div className="cd-body">
              {remaining.map((id) => {
                const c = COURSES[id];
                const missing = (c.prereqs || []).filter((p) => planIds.has(p)).filter((p) => {
                  if (completedSet.has(p) || ipSet.has(p)) return false;
                  const pa = schedAbs(p); return pa == null || pa >= pickAbs;
                });
                const ok = missing.length === 0;
                const here = schedAbs(id) === pickAbs;
                const fmt = (x) => x.replace(/([A-Z])(\d)/, "$1 $2");
                return (
                  <div key={id} className={`qp-row ${ok ? "" : "blocked"} ${here ? "here" : ""}`} onClick={() => { if (ok) { place(id, pickAbs); setPickAbs(null); } }}>
                    <div className="qp-main">
                      <div className="qp-code"><b>{fmt(id)}</b><span>{c.credits} cr</span></div>
                      <div className="qp-ttl">{c.title}</div>
                      <div className={`qp-status ${ok ? "ok" : "no"}`}>{here ? "Already in this quarter" : ok ? "✓ Prerequisites met — you can take it here" : `Needs ${missing.map(fmt).join(", ")} in an earlier quarter`}</div>
                    </div>
                    <span className="qp-add">{here ? "✓" : ok ? "＋" : "🔒"}</span>
                  </div>
                );
              })}
              {remaining.length === 0 && <div className="rb-empty">Everything's placed — nothing left to add.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- side cards ------------------------------------------------------------
const DARS_AUDIT_URL = "https://myplan.uw.edu/audit/#/degree";
function AuditCard({ program, snapshot, onResync, syncing }) {
  const a = snapshot?.audit;
  const earned = a?.earned ?? 0, total = a?.totalRequired ?? program.totalCredits;
  const pct = Math.round((earned / total) * 100);
  return (
    <div className="island card">
      <div className="eyebrow">Degree Audit {I.grad}</div>
      <h3>{program.name}</h3>
      <div className="sub">{program.school || "College of Arts & Sciences"}{snapshot ? ` · GPA ${snapshot.gpa}` : ""}</div>
      <div className="bar-row"><div className="bl"><span>Progress</span><b>{pct}%</b></div><div className="bar"><div style={{ width: `${pct}%` }} /></div></div>
      <div className="card-foot">
        <span className="big">{earned} / {total} cr</span>
        <span className="ontrack"><i />{pct >= 100 ? "Complete" : "On track"}</span>
      </div>
      <button className="resync" onClick={onResync} disabled={syncing}>{syncing ? "Reading MyPlan…" : snapshot ? "Re-sync MyPlan (DARS)" : "Connect & pull from MyPlan"}</button>
      <a className="audit-link" href={DARS_AUDIT_URL} target="_blank" rel="noreferrer">Open my DARS audit ↗</a>
    </div>
  );
}
function ThisQuarter({ ipSet, courseTerms }) {
  const list = [...ipSet].filter((id) => COURSES[id]);
  const cr = list.reduce((s, id) => s + COURSES[id].credits, 0);
  const curLabel = qLabelAbs(effectiveCurrentAbs(ipSet, courseTerms || {}));
  return (
    <div className="island card">
      <div className="eyebrow">This Quarter <span className="pill-sm">{cr} cr</span></div>
      <div style={{ marginTop: 12 }}>
        {list.map((id) => (
          <div key={id} className="tq-row"><i style={{ background: CAT_VAR[COURSES[id].category] }} /><span className="c">{id.replace(/([A-Z])(\d)/, "$1 $2")}</span><span className="t">{COURSES[id].title}</span></div>
        ))}
        {list.length === 0 && <div className="rb-empty">No enrolled courses — sync MyPlan.</div>}
      </div>
      <div className="tq-foot"><span>{curLabel} · {list.length} courses</span><span>no conflicts</span></div>
    </div>
  );
}

// ---- requirements / catalog ------------------------------------------------
function Requirements({ major, completedSet, ipSet, chosenSet, toggleCompleted, removeChosen, onOpen }) {
  return (
    <>
      <div className="section-h">Degree Requirements · Catalog</div>
      <div className="reqs">
        {major.requirements.map((r) => {
          if (r.kind === "info") return (
            <div className="island req-bucket" key={r.id}><div className="rb-head"><div><div className="rb-title">{r.label} {r.met && <span className="met">✓ met</span>}</div><div className="rb-sub">{r.note}</div></div></div></div>
          );
          const all = r.kind === "all";
          const fulfilling = all ? r.courses : r.courses.filter((id) => completedSet.has(id) || ipSet.has(id) || chosenSet.has(id));
          const doneCr = fulfilling.filter((id) => completedSet.has(id)).reduce((s, id) => s + COURSES[id].credits, 0);
          const ipCr = fulfilling.filter((id) => ipSet.has(id)).reduce((s, id) => s + COURSES[id].credits, 0);
          const planCr = fulfilling.filter((id) => chosenSet.has(id) && !completedSet.has(id) && !ipSet.has(id)).reduce((s, id) => s + COURSES[id].credits, 0);
          const doneCount = fulfilling.filter((id) => completedSet.has(id) || ipSet.has(id)).length;
          let need, have, unit;
          if (r.kind === "credits") { need = r.needCredits; have = doneCr + ipCr + planCr; unit = "cr"; }
          else if (r.kind === "choose") { need = r.needCount; have = fulfilling.length; unit = ""; }
          else { need = r.courses.length; have = doneCount; unit = ""; }
          const pct = Math.min(100, Math.round((have / need) * 100)), met = have >= need;
          const candidates = r.courses.filter((id) => !completedSet.has(id) && !ipSet.has(id) && !chosenSet.has(id));
          return (
            <div className="island req-bucket" key={r.id}>
              <div className="rb-head"><div><div className="rb-title">{r.label} {met && <span className="met">✓ met</span>}</div>
                <div className="rb-sub">{r.kind === "credits" ? `${doneCr} done · ${ipCr} in-prog · ${planCr} planned` : `${doneCount} done`} · need {need} {unit || "courses"}</div></div>
                <div className="rb-count">{have}/{need}{unit ? " cr" : ""}</div></div>
              <div className="rb-bar"><div className="rb-fill" style={{ width: `${pct}%`, background: met ? "var(--enrolled)" : "var(--planned)" }} /></div>
              <div className="rb-chips">
                {fulfilling.map((id) => { const c = COURSES[id]; const done = completedSet.has(id), ip = ipSet.has(id);
                  return <span key={id} className={`chip ${done ? "done" : ip ? "ip" : "planned"}`}><i className="d" style={{ background: CAT_VAR[c.category] }} /><b onClick={() => toggleCompleted(id)}>{id}</b><span className="cr">{c.credits}</span>{!all && !done && !ip && <button className="x" onClick={() => removeChosen(id)}>×</button>}</span>; })}
                {fulfilling.length === 0 && <span className="rb-empty">Nothing selected yet.</span>}
              </div>
              {r.kind !== "all" && (
                <button className="rb-browse" onClick={() => onOpen(r)}>★ Recommended &amp; all courses →</button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---- category detail: Recommended + All available -------------------------
const SHORT_AREA = { arts: "A&H", social: "SSc", science: "NSc", diversity: "DIV", writing: "W", core400: "CSE" };

function CourseRow({ id, reasons, chosen, onAdd, onRemove }) {
  const c = COURSES[id];
  return (
    <div className="cd-course">
      <div className="cd-c-main">
        <div className="cd-c-head">
          <b>{id.replace(/(\d)/, " $1")}</b><span className="cd-cr">{c.credits} cr</span>
          {(c.gened || [c.category]).map((g) => <span key={g} className="gbadge" style={{ borderColor: CAT_VAR[g] || "var(--glass-brd)" }}>{SHORT_AREA[g] || g}</span>)}
        </div>
        <div className="cd-c-ttl">{c.title}</div>
        {reasons && reasons.length > 0 && <div className="cd-reasons">{reasons.slice(0, 3).map((r, i) => <span key={i} className="rchip">{r}</span>)}</div>}
      </div>
      {chosen
        ? <button className="cd-add added" onClick={onRemove}>✓ Added</button>
        : <button className="cd-add" onClick={onAdd}>＋ Add</button>}
    </div>
  );
}

function CategoryDetail({ req, major, completedSet, ipSet, chosenSet, addChosen, removeChosen, onClose }) {
  const [tab, setTab] = useState("rec");
  const taken = useMemo(() => new Set([...completedSet, ...ipSet]), [completedSet, ipSet]);
  const pool = useMemo(() => poolForArea(req.area), [req.area]);

  const isCredits = req.kind === "credits";
  const doneCr = pool.filter((c) => completedSet.has(c.id)).reduce((s, c) => s + c.credits, 0);
  const ipCr = pool.filter((c) => ipSet.has(c.id)).reduce((s, c) => s + c.credits, 0);
  const planCr = pool.filter((c) => chosenSet.has(c.id) && !taken.has(c.id)).reduce((s, c) => s + c.credits, 0);
  const need = isCredits ? req.needCredits : req.needCount;
  const remainingCredits = isCredits ? Math.max(0, need - (doneCr + ipCr + planCr)) : 0;
  const haveLabel = isCredits ? `${doneCr + ipCr} done · ${planCr} planned` : `${pool.filter((c) => taken.has(c.id) || chosenSet.has(c.id)).length} selected`;

  const remainingMap = useMemo(() => computeRemaining(major, completedSet, ipSet, chosenSet), [major, completedSet, ipSet, chosenSet]);
  const recs = useMemo(() => recommend({ area: req.area, remainingMap, taken, planned: chosenSet, satisfied: taken }), [req.area, remainingMap, taken, chosenSet]);
  const top = recs.slice(0, 6);
  const all = pool.filter((c) => !taken.has(c.id)).sort((a, b) => a.id.localeCompare(b.id));

  return (
    <div className="cd-overlay" onClick={onClose}>
      <div className="island cd-card" onClick={(e) => e.stopPropagation()}>
        <div className="cd-head">
          <div>
            <div className="cd-title">{req.label}</div>
            <div className="cd-sub">{isCredits ? `Need ${need} cr · ${haveLabel} · ${remainingCredits} cr left` : `${haveLabel} · need ${need} courses`}</div>
          </div>
          <button className="cd-close" onClick={onClose}>×</button>
        </div>
        <div className="cd-tabs">
          <button className={tab === "rec" ? "active" : ""} onClick={() => setTab("rec")}>★ Recommended</button>
          <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>All available ({all.length})</button>
        </div>
        <div className="cd-body">
          {tab === "rec" && (
            <>
              <p className="cd-note">Ranked for your degree — credit fit to what you still need, double-counted requirements, and CS relevance, excluding courses you've taken.</p>
              {remainingCredits === 0 && isCredits && <p className="cd-note" style={{ color: "var(--enrolled)" }}>This requirement is already met — extra courses would double-count or count as electives.</p>}
              {top.map((r) => (
                <CourseRow key={r.id} id={r.id} reasons={r.reasons} chosen={chosenSet.has(r.id)} onAdd={() => addChosen(r.id)} onRemove={() => removeChosen(r.id)} />
              ))}
            </>
          )}
          {tab === "all" && all.map((c) => (
            <CourseRow key={c.id} id={c.id} chosen={chosenSet.has(c.id)} onAdd={() => addChosen(c.id)} onRemove={() => removeChosen(c.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- majors & minors picker ------------------------------------------------
const AREA_NAME = { science: "Natural Science", arts: "Arts & Hum.", social: "Social Sci.", core400: "Advanced", writing: "Writing", diversity: "Diversity" };
function describeDelta(d) {
  if (d.kind === "all") return `+${d.courses.length} required courses`;
  if (d.addCredits != null) return `+${d.addCredits} ${AREA_NAME[d.area] || d.area} cr`;
  if (d.addCount != null) return `+${d.addCount} ${AREA_NAME[d.area] || d.area} courses`;
  return "";
}
function MajorsMinors({ majorId, minorIds, onMajor, onToggleMinor, onClose }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const majors = MAJOR_CATALOG.filter((m) => !needle || m.name.toLowerCase().includes(needle) || m.school.toLowerCase().includes(needle));
  const minors = Object.values(MINORS).filter((m) => !needle || m.name.toLowerCase().includes(needle));
  return (
    <div className="cd-overlay" onClick={onClose}>
      <div className="island cd-card" onClick={(e) => e.stopPropagation()}>
        <div className="cd-head">
          <div><div className="cd-title">Majors &amp; Minors</div><div className="cd-sub">Switch your major or add a minor — your plan re-checks against the new requirements.</div></div>
          <button className="cd-close" onClick={onClose}>×</button>
        </div>
        <div className="cd-body">
          <input className="mm-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search majors & minors…" autoFocus />
          <div className="section-h" style={{ margin: "0 0 10px" }}>Major <span className="mm-count">{majors.length}</span></div>
          {majors.map((m) => (
            <label key={m.id} className={`mm-row ${majorId === m.id ? "sel" : ""}`}>
              <input type="radio" name="major" checked={majorId === m.id} onChange={() => onMajor(m.id)} />
              <div className="mm-info"><b>{m.name}</b><span>{m.school}</span></div>
            </label>
          ))}
          <div className="section-h" style={{ margin: "18px 0 10px" }}>Minors <span className="mm-count">{minors.length}</span></div>
          {minors.map((m) => (
            <label key={m.id} className={`mm-row ${minorIds.includes(m.id) ? "sel" : ""}`}>
              <input type="checkbox" checked={minorIds.includes(m.id)} onChange={() => onToggleMinor(m.id)} />
              <div className="mm-info"><b>{m.name}</b><span>{(m.deltas && m.deltas.length) ? m.deltas.map(describeDelta).join(" · ") : "Department requirements (from DARS)"}</span></div>
            </label>
          ))}
        </div>
        <div className="mm-foot">
          <span className="mm-savenote">Changes apply live and save to your account.</span>
          <button className="btn" onClick={onClose}>Save &amp; close</button>
        </div>
      </div>
    </div>
  );
}

// ---- account modal ---------------------------------------------------------
function AccountModal({ user, snapshot, program, onSignOut, onClose }) {
  return (
    <div className="cd-overlay" onClick={onClose}>
      <div className="island cd-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="cd-head"><div><div className="cd-title">Account</div><div className="cd-sub">Signed in to Liquid Planner</div></div><button className="cd-close" onClick={onClose}>×</button></div>
        <div className="cd-body">
          <div className="acct-row"><div className="acct-avatar">{(user.name || "?").slice(0, 1).toUpperCase()}</div><div><b>{user.name}</b><div className="acct-email">{user.email}</div></div></div>
          <div className="acct-stats">
            <div><span>Program</span><b>{program.name}</b></div>
            {snapshot && <div><span>Credits</span><b>{snapshot.audit.earned} / {snapshot.audit.totalRequired}</b></div>}
            {snapshot && <div><span>GPA</span><b>{snapshot.gpa}</b></div>}
            <div><span>Last MyPlan sync</span><b>{snapshot?.fetchedAt ? new Date(snapshot.fetchedAt).toLocaleDateString() : "—"}</b></div>
          </div>
          <button className="btn" style={{ width: "100%", marginTop: 16 }} onClick={onSignOut}>Sign out</button>
        </div>
      </div>
    </div>
  );
}

// ---- Design Studio: full-screen immersive path designer --------------------
function DesignStudio({ program, completedSet, ipSet, chosenSet, addChosen, removeChosen, onAutoPlan, onClose }) {
  const taken = useMemo(() => new Set([...completedSet, ...ipSet]), [completedSet, ipSet]);
  const remainingMap = useMemo(() => computeRemaining(program, completedSet, ipSet, chosenSet), [program, completedSet, ipSet, chosenSet]);
  const openReqs = program.requirements.filter((r) => (r.kind === "credits" || r.kind === "choose") && (remainingMap[r.area]?.remaining > 0));
  const totalRemaining = Object.values(remainingMap).reduce((s, r) => s + (r.kind === "credits" ? r.remaining : 0), 0);
  return (
    <div className="design-studio">
      <div className="ds-aurora"><span className="blob b1" /><span className="blob b2" /><span className="blob b3" /></div>
      <div className="ds-inner">
        <div className="ds-topbar">
          <div><div className="ds-eyebrow">Design Studio</div><h2>Design your path</h2><p>{program.name} · about {totalRemaining} gen-ed credits left to choose</p></div>
          <div className="ds-actions">
            <button className="btn ds-auto" onClick={onAutoPlan}>✦ Auto-plan everything</button>
            <button className="ds-close" onClick={onClose}>Close ✕</button>
          </div>
        </div>
        <div className="ds-grid">
          {openReqs.map((r) => {
            const recs = recommend({ area: r.area, remainingMap, taken, planned: chosenSet, satisfied: taken }).slice(0, 4);
            const rem = remainingMap[r.area];
            return (
              <div className="island ds-card" key={r.id}>
                <div className="ds-card-head"><b>{r.label.replace(/ —.*/, "")}</b><span className="ds-left">{rem.kind === "credits" ? `${rem.remaining} cr left` : `${rem.remaining} to pick`}</span></div>
                <div className="ds-recs">
                  {recs.map((rc) => {
                    const c = COURSES[rc.id]; const on = chosenSet.has(rc.id);
                    return (
                      <div className={`ds-rec ${on ? "on" : ""}`} key={rc.id} onClick={() => on ? removeChosen(rc.id) : addChosen(rc.id)}>
                        <div className="ds-rec-main">
                          <div className="ds-rec-code"><b>{rc.id.replace(/([A-Z])(\d)/, "$1 $2")}</b><span>{c.credits} cr</span></div>
                          <div className="ds-rec-ttl">{c.title}</div>
                          {rc.reasons && rc.reasons[0] && <div className="ds-reason">{rc.reasons[0]}</div>}
                        </div>
                        <span className="ds-add">{on ? "✓" : "＋"}</span>
                      </div>
                    );
                  })}
                  {recs.length === 0 && <div className="ds-empty">No more qualifying courses listed.</div>}
                </div>
              </div>
            );
          })}
          {openReqs.length === 0 && <div className="island ds-done">🎉 Every gen-ed area is on track. Hit <b>Auto-plan everything</b> to lay it across your quarters.</div>}
        </div>
      </div>
    </div>
  );
}

// ---- MyPlan handoff modal (production import via bookmarklet) ---------------
const DARS_URL = "https://myplan.uw.edu/audit/#/degree";

function HandoffModal({ token, onClose, onImported, onDemo }) {
  const [code, setCode] = useState(null);
  const [paste, setPaste] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // pre-fetch a one-time import code (used by both paste and the optional bookmarklet)
  useEffect(() => {
    let alive = true;
    (async () => { const r = await startImport(token); if (alive) setCode(r?.code || null); })();
    return () => { alive = false; };
  }, [token]);

  // poll only matters for the optional bookmarklet path
  useEffect(() => {
    if (!code) return;
    const iv = setInterval(async () => {
      const snap = await getSnapshot(token);
      if (snap && snap.source?.includes("imported")) { clearInterval(iv); onImported(snap); }
    }, 3000);
    return () => clearInterval(iv);
  }, [code, token]);

  async function submitPaste() {
    if (!paste.trim()) return;
    setBusy(true); setStatus("Reading your audit…");
    let c = code;
    if (!c) { const r = await startImport(token); c = r?.code; setCode(c); }
    if (!c) { setStatus("Couldn't reach the server. Try again or use sample data."); setBusy(false); return; }
    const r = await importDars(c, paste);
    const parsedSomething = r?.ok && ((r.earnedCount + r.inProgressCount) > 0 || r.audit?.earned > 0);
    if (parsedSomething) {
      const snap = await getSnapshot(token);
      if (snap) { onImported(snap); return; }
    }
    setStatus("Hmm — that didn't look like a DARS page. Make sure you selected the whole audit (⌘A) and copied it (⌘C).");
    setBusy(false);
  }

  const bm = code
    ? `javascript:(function(){fetch('${API_BASE}/api/import/${code}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({darsText:document.body.innerText})}).then(function(r){return r.json()}).then(function(j){alert('Liquid Planner: imported '+((j.audit&&j.audit.earned)||0)+' credits. Return to the app.')}).catch(function(){alert('Import failed — open your DARS audit first.')})})();`
    : "#";

  return (
    <div className="cd-overlay" onClick={onClose}>
      <div className="island cd-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="cd-head">
          <div><div className="cd-title">Sync from MyPlan</div><div className="cd-sub">Copy your DARS audit and paste it — no setup, no extensions.</div></div>
          <button className="cd-close" onClick={onClose}>×</button>
        </div>
        <div className="cd-body">
          <ol className="ho-steps">
            <li><a className="ho-link" href={DARS_URL} target="_blank" rel="noreferrer">Open your DARS audit ↗</a> (sign in with your UW NetID if asked).</li>
            <li>On that page, select all (<b>⌘A</b>) and copy (<b>⌘C</b>).</li>
            <li>Paste it here and import:</li>
          </ol>
          <textarea className="ho-ta" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste your DARS audit here…" />
          <button className="btn ho-import" onClick={submitPaste} disabled={busy || !paste.trim()}>{busy ? "Importing…" : "Import my audit"}</button>
          {status && <div className="ho-status">{status}</div>}

          <details className="ho-adv">
            <summary>Advanced: one-click bookmarklet (Chrome/Edge)</summary>
            <p className="hint" style={{ marginTop: 8 }}>Drag this to your bookmarks bar, then click it while on your DARS page — it imports automatically. (Safari blocks this unless dragged to the bar; the paste method above always works.)</p>
            <a className="ho-bm" href={bm} onClick={(e) => e.preventDefault()} draggable>📥 Import to Liquid Planner</a>
            <button className="ho-copy" onClick={() => { navigator.clipboard?.writeText(bm); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied" : "Copy"}</button>
          </details>
          <button className="ho-demo" onClick={onDemo}>Use sample data instead (demo)</button>
        </div>
      </div>
    </div>
  );
}

// ---- app -------------------------------------------------------------------
export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [oidcEnabled, setOidcEnabled] = useState({});
  const [completed, setCompleted] = useState([]);
  const [inProgress, setInProgress] = useState([]);
  const [chosen, setChosen] = useState([]);
  const [schedule, setSchedule] = useState({});
  const [snapshot, setSnapshot] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("plan");      // plan | catalog
  const [mode, setMode] = useState("plan");       // plan | grid (within board)
  const [orbOpen, setOrbOpen] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [now, setNow] = useState(new Date());
  const [detailReq, setDetailReq] = useState(null);
  const [showHandoff, setShowHandoff] = useState(false);
  const [showMajors, setShowMajors] = useState(false);
  const [showDesign, setShowDesign] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [majorId, setMajorId] = useState("cs");
  const [minorIds, setMinorIds] = useState([]);
  const [courseTerms, setCourseTerms] = useState({});
  const didAutoSync = useRef(false);

  const program = useMemo(() => buildProgram(resolveProgram(majorId), minorIds), [majorId, minorIds]);
  const completedSet = useMemo(() => new Set(completed), [completed]);
  const ipSet = useMemo(() => new Set(inProgress), [inProgress]);
  const chosenSet = useMemo(() => new Set(chosen), [chosen]);
  const planIds = useMemo(() => buildPlanIds(program, completedSet, ipSet, chosenSet), [program, completedSet, ipSet, chosenSet]);

  useEffect(() => { apiHealth().then((j) => { setBackendOnline(!!j?.ok); setOidcEnabled(j?.oidc || {}); }); }, []);
  // expose the API base so the browser extension can sync on the student's behalf
  useEffect(() => { try { localStorage.setItem("lp_api", API_BASE); } catch { /* ignore */ } }, []);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  // session restore, and capture the token returned from a UW NetID (OIDC) redirect
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const t = h.get("token");
    if (t) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      me(t).then((u) => { if (u) { setUser(u); setToken(t); } });
      return;
    }
    try { const s = JSON.parse(localStorage.getItem("lp_session") || "null"); if (s?.token && s?.user) { setUser(s.user); setToken(s.token); } } catch { /* ignore */ }
  }, []);
  useEffect(() => { try { if (user && token) localStorage.setItem("lp_session", JSON.stringify({ user, token })); } catch { /* ignore */ } }, [user, token]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const [plan, snap] = await Promise.all([getPlan(token), getSnapshot(token)]);
      if (plan) {
        if (plan.chosen?.length) setChosen(plan.chosen);
        if (plan.completed?.length) setCompleted(plan.completed);
        if (plan.inProgress?.length) setInProgress(plan.inProgress);
        if (plan.schedule) { // drop stale index-format values from older plans
          const clean = {}; for (const k in plan.schedule) { const v = plan.schedule[k]; if (typeof v === "number" && v > 5000) clean[k] = v; }
          if (Object.keys(clean).length) setSchedule(clean);
        }
        if (plan.majorId && MAJORS[plan.majorId]) setMajorId(plan.majorId);
        if (Array.isArray(plan.minorIds)) setMinorIds(plan.minorIds);
      }
      if (snap) { setSnapshot(snap); if (snap.terms) setCourseTerms((t) => ({ ...t, ...snap.terms })); }
      setLoaded(true);
    })();
  }, [token]);
  useEffect(() => {
    if (!token || !loaded) return;
    const t = setTimeout(() => savePlan(token, { chosen, completed, inProgress, schedule, majorId, minorIds }), 600);
    return () => clearTimeout(t);
  }, [token, loaded, chosen, completed, inProgress, schedule, majorId, minorIds]);

  async function handleSignIn(profile) {
    if (backendOnline) { try { const { token: tk, user: u } = await devLogin(profile); setUser(u); setToken(tk); return; } catch { /* local */ } }
    setUser(profile);
  }
  // NetID sign-in pulls MyPlan automatically (no manual Re-sync needed).
  useEffect(() => {
    if (user?.provider === "netid" && !snapshot && !syncing && !didAutoSync.current) {
      didAutoSync.current = true; handleSync();
    }
  }, [user, snapshot, syncing]); // eslint-disable-line
  function applySnapshot(snap) {
    setSnapshot(snap);
    setCompleted((p) => [...new Set([...p, ...(snap.earned || [])])]);
    setInProgress((p) => [...new Set([...p, ...(snap.inProgress || [])])]);
    if (snap.terms) setCourseTerms((t) => ({ ...t, ...snap.terms }));
  }
  async function handleSyncLocal() {
    setSyncing(true);
    const snap = await fetchMyPlanSnapshot();
    applySnapshot(snap);
    if (token) postSnapshot(token, snap);
    setSyncing(false);
  }
  // Production handoff when signed in to the backend; demo fetch otherwise.
  function handleSync() {
    if (backendOnline && token) setShowHandoff(true);
    else handleSyncLocal();
  }
  function autoPlan() {
    // 1) auto-select max-coverage gen-ed / elective courses to fill open requirements
    const adds = autoSelect(program, completedSet, ipSet, chosenSet);
    const newChosen = [...new Set([...chosen, ...adds])];
    // 2) schedule the whole plan across quarters
    const newPlan = buildPlanIds(program, completedSet, ipSet, new Set(newChosen));
    setChosen(newChosen);
    setSchedule(scheduleAll(newPlan, completedSet, ipSet));
    setView("plan");
  }
  function toggleCompleted(id) { setCompleted((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]); }
  const addChosen = (id) => setChosen((p) => p.includes(id) ? p : [...p, id]);
  const removeChosen = (id) => setChosen((p) => p.filter((x) => x !== id));

  if (!user) return <Login onSignIn={handleSignIn} backendOnline={backendOnline} oidcEnabled={oidcEnabled} />;

  const plannedCount = [...planIds].filter((id) => !completedSet.has(id) && !ipSet.has(id) && schedule[id] != null).length;
  const mappedCredits = [...planIds].filter((id) => ipSet.has(id) || schedule[id] != null).reduce((s, id) => s + COURSES[id].credits, 0);
  const prereqLinks = [...planIds].reduce((n, id) => n + (COURSES[id].prereqs || []).filter((p) => planIds.has(p)).length, 0);
  const hour = now.getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const dialItems = [
    { key: "settings", label: "Settings", icon: I.gear, onClick: () => {} },
    { key: "planview", label: "Plan View", icon: I.cal, onClick: () => setView("plan") },
    { key: "catalog", label: "Catalog", icon: I.search, onClick: () => setView("catalog") },
    { key: "majors", label: "Majors", icon: I.grad, onClick: () => setShowMajors(true) },
    { key: "add", label: "Add Class", icon: I.plus, onClick: () => setView("catalog") },
    { key: "auto", label: "Auto Plan", icon: I.spark, onClick: autoPlan },
  ];

  return (
    <>
      <Sky />
      <div className="dock island">
        <button className={view === "plan" ? "active" : ""} onClick={() => setView("plan")} title="Plan">{I.home}</button>
        <button className={view === "catalog" ? "active" : ""} onClick={() => setView("catalog")} title="Catalog">{I.search}</button>
        <div className="sep" />
        <button className={showAccount ? "active" : ""} onClick={() => setShowAccount(true)} title="Account">{I.user}</button>
      </div>

      <div className="app">
        <div className="toprow">
          <div className="greeting">
            <div className="eyebrow">{snapshot?.catalogYear || "2026 – 2027"} Degree Plan</div>
            <h1>{greet}, {user.name?.split(" ")[0] || "Student"}</h1>
            <p>{mappedCredits} credits mapped across your plan · {prereqLinks} prerequisites linked.</p>
          </div>
          <AssistantOrb open={orbOpen} onToggle={setOrbOpen} items={dialItems} />
          <div className="clockwrap"><div className="island clock">
            <b>{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</b><span className="dotsep">•</span><span>Seattle</span>
          </div></div>
        </div>

        <div className="layout">
          <div className="plan-col">
            {view === "plan"
              ? <PlanBoard program={program} snapshot={snapshot} planIds={planIds} completedSet={completedSet} ipSet={ipSet} courseTerms={courseTerms} schedule={schedule} setSchedule={setSchedule} mode={mode} setMode={setMode} />
              : <Requirements major={program} completedSet={completedSet} ipSet={ipSet} chosenSet={chosenSet} toggleCompleted={toggleCompleted} removeChosen={removeChosen} onOpen={setDetailReq} />}
          </div>
          <div className="side">
            <AuditCard program={program} snapshot={snapshot} onResync={handleSync} syncing={syncing} />
            <ThisQuarter ipSet={ipSet} courseTerms={courseTerms} />
            <div className="island card" style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div><b style={{ fontSize: 13 }}>{user.name}</b><div style={{ fontSize: 11, color: "var(--text-dim)" }}>{user.email}</div></div>
              <button className="signout" onClick={() => { try { localStorage.removeItem("lp_session"); } catch { /* */ } didAutoSync.current = false; setUser(null); setToken(null); setLoaded(false); setSnapshot(null); setCompleted([]); setInProgress([]); setChosen([]); setSchedule({}); }}>Sign out</button>
            </div>
          </div>
        </div>

      </div>

      <div className="toolbar island">
        <button onClick={() => setShowDesign(true)}>{I.pen}<span>Design</span></button>
        <button onClick={() => setView("catalog")}>{I.plus}<span>Add</span></button>
        <button onClick={() => setShowMajors(true)}>{I.grad}<span>Majors &amp; Minors</span></button>
        <button className="primary" onClick={autoPlan}>{I.spark}<span>Auto Plan</span></button>
        <button onClick={() => setSchedule({})}>{I.undo}<span>Reset</span></button>
      </div>

      {detailReq && (
        <CategoryDetail req={detailReq} major={program} completedSet={completedSet} ipSet={ipSet} chosenSet={chosenSet}
          addChosen={addChosen} removeChosen={removeChosen} onClose={() => setDetailReq(null)} />
      )}
      {showMajors && (
        <MajorsMinors majorId={majorId} minorIds={minorIds}
          onMajor={(id) => { setMajorId(id); setChosen([]); setSchedule({}); }}
          onToggleMinor={(id) => setMinorIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])}
          onClose={() => setShowMajors(false)} />
      )}
      {showHandoff && (
        <HandoffModal token={token}
          onClose={() => setShowHandoff(false)}
          onImported={(snap) => { applySnapshot(snap); setShowHandoff(false); }}
          onDemo={() => { setShowHandoff(false); handleSyncLocal(); }} />
      )}
      {showDesign && (
        <DesignStudio program={program} completedSet={completedSet} ipSet={ipSet} chosenSet={chosenSet}
          addChosen={addChosen} removeChosen={removeChosen}
          onAutoPlan={() => { autoPlan(); setShowDesign(false); }} onClose={() => setShowDesign(false)} />
      )}
      {showAccount && (
        <AccountModal user={user} snapshot={snapshot} program={program}
          onSignOut={() => { try { localStorage.removeItem("lp_session"); } catch { /* */ } didAutoSync.current = false; setUser(null); setToken(null); setLoaded(false); setSnapshot(null); setCompleted([]); setInProgress([]); setChosen([]); setSchedule({}); setShowAccount(false); }}
          onClose={() => setShowAccount(false)} />
      )}
    </>
  );
}
