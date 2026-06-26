import React, { useMemo, useState, useEffect } from "react";
import {
  UNIVERSITY,
  MAJORS,
  CATEGORY_LABELS,
  fetchCompletedCourses,
} from "./data.js";

// ---------------------------------------------------------------------------
// Quarter calendar (UW runs on quarters: Autumn / Winter / Spring, + Summer)
// ---------------------------------------------------------------------------
const TERMS = ["Autumn", "Winter", "Spring"];
const NUM_YEARS = 4;
const QUARTERS = [];
for (let y = 1; y <= NUM_YEARS; y++) {
  for (const t of TERMS) {
    QUARTERS.push({ idx: QUARTERS.length, label: `${t}`, year: y, term: t });
  }
}
const FULL_TIME_MIN = 12;
const NORMAL_MAX = 18;

// ---- status helpers --------------------------------------------------------
function statusOf(course, completedSet, courseIds) {
  if (completedSet.has(course.id)) return "done";
  const relevant = course.prereqs.filter((p) => courseIds.has(p));
  const ready = relevant.every((p) => completedSet.has(p));
  return ready ? "avail" : "locked";
}

// ---- graph layout: assign each course a column by prereq depth -------------
function layoutGraph(courses, courseIds) {
  const byId = Object.fromEntries(courses.map((c) => [c.id, c]));
  const depthCache = {};
  const depth = (id, seen = new Set()) => {
    if (depthCache[id] != null) return depthCache[id];
    if (seen.has(id)) return 0;
    seen.add(id);
    const ps = byId[id].prereqs.filter((p) => courseIds.has(p));
    const d = ps.length === 0 ? 0 : 1 + Math.max(...ps.map((p) => depth(p, seen)));
    depthCache[id] = d;
    return d;
  };
  const cols = {};
  courses.forEach((c) => {
    const d = depth(c.id);
    (cols[d] = cols[d] || []).push(c);
  });
  const COL_W = 210, ROW_H = 96, NODE_W = 150, NODE_H = 74, PAD = 16;
  const pos = {};
  let maxRows = 0;
  Object.keys(cols).forEach((d) => {
    const list = cols[d].sort((a, b) => a.category.localeCompare(b.category));
    maxRows = Math.max(maxRows, list.length);
    list.forEach((c, row) => {
      pos[c.id] = { x: PAD + d * COL_W, y: PAD + row * ROW_H };
    });
  });
  return { pos, width: PAD * 2 + Object.keys(cols).length * COL_W, height: PAD * 2 + maxRows * ROW_H, NODE_W, NODE_H, depth };
}

const CAT_VAR = {
  intro: "var(--cat-intro)", math: "var(--cat-math)", core: "var(--cat-core)",
  core400: "var(--cat-core400)", science: "var(--cat-science)", gened: "var(--cat-gened)",
};

// ---- pathway graph view ----------------------------------------------------
function GraphView({ courses, completedSet, courseIds }) {
  const { pos, width, height, NODE_W, NODE_H } = useMemo(
    () => layoutGraph(courses, courseIds), [courses, courseIds]);
  const edges = [];
  courses.forEach((c) => {
    c.prereqs.filter((p) => courseIds.has(p)).forEach((p) => {
      const a = pos[p], b = pos[c.id];
      if (a && b) edges.push({ key: `${p}-${c.id}`, x1: a.x + NODE_W, y1: a.y + NODE_H / 2, x2: b.x, y2: b.y + NODE_H / 2 });
    });
  });
  return (
    <div className="island graph-wrap">
      <div className="graph-inner" style={{ width, height }}>
        <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {edges.map((e) => {
            const mx = (e.x1 + e.x2) / 2;
            return <path key={e.key} d={`M ${e.x1} ${e.y1} C ${mx} ${e.y1}, ${mx} ${e.y2}, ${e.x2} ${e.y2}`}
              fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.6" />;
          })}
        </svg>
        {courses.map((c) => {
          const p = pos[c.id];
          const st = statusOf(c, completedSet, courseIds);
          return (
            <div key={c.id} className={`node s-${st}`} style={{ left: p.x, top: p.y, width: NODE_W }}>
              <div className="code"><span>{c.id}</span><span className="pill">{st === "done" ? "✓" : st === "avail" ? "•" : "🔒"}</span></div>
              <div className="cat-bar" style={{ background: CAT_VAR[c.category] }} />
              <div className="ttl">{c.title}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interactive quarter planner
// ---------------------------------------------------------------------------
function QuarterPlanner({ major, courses, completedSet, courseIds }) {
  const byId = useMemo(() => Object.fromEntries(courses.map((c) => [c.id, c])), [courses]);
  const completedCredits = useMemo(
    () => courses.filter((c) => completedSet.has(c.id)).reduce((s, c) => s + c.credits, 0),
    [courses, completedSet]
  );
  const requiredCredits = major.totalCredits;

  // schedule: courseId -> quarter index. Unscheduled (remaining) courses live in the pool.
  const [schedule, setSchedule] = useState({});
  const [dragId, setDragId] = useState(null);

  // Reset schedule whenever the transcript changes.
  useEffect(() => { setSchedule({}); }, [major.id, completedCredits]);

  const remaining = useMemo(() => courses.filter((c) => !completedSet.has(c.id)), [courses, completedSet]);
  const poolCourses = remaining.filter((c) => schedule[c.id] == null);

  function place(courseId, qIdx) {
    setSchedule((s) => ({ ...s, [courseId]: qIdx }));
  }
  function unplace(courseId) {
    setSchedule((s) => { const n = { ...s }; delete n[courseId]; return n; });
  }

  // ---- prereq validation across the timeline ----
  function violationFor(c) {
    const q = schedule[c.id];
    if (q == null) return null;
    const missing = [];
    c.prereqs.filter((p) => courseIds.has(p)).forEach((p) => {
      if (completedSet.has(p)) return;                 // already done
      const pq = schedule[p];
      if (pq == null) missing.push(`${p} not planned`);
      else if (pq >= q) missing.push(`${p} must come earlier`);
    });
    return missing.length ? missing : null;
  }

  // ---- per-quarter + cumulative credit totals ----
  const quarterData = QUARTERS.map((qd) => {
    const list = remaining.filter((c) => schedule[c.id] === qd.idx);
    const credits = list.reduce((s, c) => s + c.credits, 0);
    return { ...qd, list, credits };
  });
  let running = completedCredits;
  const cumulative = quarterData.map((q) => (running += q.credits));

  const plannedCredits = quarterData.reduce((s, q) => s + q.credits, 0);
  const lastUsed = quarterData.reduce((m, q, i) => (q.list.length ? i : m), -1);
  const gradQuarter = lastUsed >= 0 ? QUARTERS[lastUsed] : null;
  const totalProjected = completedCredits + plannedCredits;

  // ---- auto-plan: greedily place remaining courses respecting prereqs ----
  function autoPlan() {
    const { depth } = layoutGraph(courses, courseIds);
    const order = [...remaining].sort((a, b) => depth(a.id) - depth(b.id) || b.credits - a.credits);
    const placed = {};            // courseId -> qIdx
    const load = QUARTERS.map(() => 0);
    const target = 15;
    order.forEach((c) => {
      // earliest quarter after all prereqs are satisfied
      let earliest = 0;
      c.prereqs.filter((p) => courseIds.has(p)).forEach((p) => {
        if (completedSet.has(p)) return;
        if (placed[p] != null) earliest = Math.max(earliest, placed[p] + 1);
      });
      let q = earliest;
      while (q < QUARTERS.length && load[q] + c.credits > target && load[q] >= target - 3) q++;
      if (q >= QUARTERS.length) q = QUARTERS.length - 1;
      placed[c.id] = q;
      load[q] += c.credits;
    });
    setSchedule(placed);
  }

  const dragProps = (courseId) => ({
    draggable: true,
    onDragStart: () => setDragId(courseId),
    onDragEnd: () => setDragId(null),
  });
  const dropProps = (handler) => ({
    onDragOver: (e) => e.preventDefault(),
    onDrop: (e) => { e.preventDefault(); if (dragId) handler(dragId); setDragId(null); },
  });

  return (
    <div className="planner">
      {/* summary */}
      <div className="island planner-summary">
        <div className="ps-item"><div className="num">{completedCredits}</div><div className="lbl">Credits completed</div></div>
        <div className="ps-item"><div className="num">{plannedCredits}</div><div className="lbl">Credits planned</div></div>
        <div className="ps-item"><div className="num" style={{ color: totalProjected >= requiredCredits ? "var(--done)" : "var(--text)" }}>
          {totalProjected}/{requiredCredits}</div><div className="lbl">Projected total</div></div>
        <div className="ps-item"><div className="num">{gradQuarter ? `${gradQuarter.term} Y${gradQuarter.year}` : "—"}</div><div className="lbl">Projected finish</div></div>
        <div className="ps-actions">
          <button className="btn" onClick={autoPlan}>Auto-plan path</button>
          <button className="btn ghost" onClick={() => setSchedule({})}>Clear</button>
        </div>
      </div>

      <div className="planner-cols">
        {/* unscheduled pool */}
        <div className="island pool" {...dropProps(unplace)}>
          <h4>To place <small>{poolCourses.length}</small></h4>
          <p className="hint">Drag a course into a quarter →</p>
          {poolCourses.map((c) => (
            <div key={c.id} className={`course-chip s-${statusOf(c, completedSet, courseIds)}`} {...dragProps(c.id)}>
              <div className="code"><span>{c.id}</span><span className="tag">{c.credits} cr</span></div>
              <div className="ttl">{c.title}</div>
            </div>
          ))}
          {poolCourses.length === 0 && <div className="hint">All remaining courses placed ✓</div>}
        </div>

        {/* quarter columns */}
        <div className="quarters-scroll">
          {quarterData.map((q, i) => {
            const over = q.credits > NORMAL_MAX;
            const under = q.credits > 0 && q.credits < FULL_TIME_MIN;
            return (
              <div key={q.idx} className="island q-col" {...dropProps((id) => place(id, q.idx))}>
                <div className="q-head">
                  <div className="q-title">{q.term} <small>Yr {q.year}</small></div>
                  <div className={`q-credits ${over ? "over" : under ? "under" : ""}`}>{q.credits} cr</div>
                </div>
                <div className="q-bar"><div className="q-bar-fill" style={{ width: `${Math.min(100, (q.credits / NORMAL_MAX) * 100)}%` }} /></div>
                <div className="q-cum">Σ {cumulative[i]} cr</div>
                {q.list.map((c) => {
                  const viol = violationFor(c);
                  return (
                    <div key={c.id} className={`course-chip s-${statusOf(c, completedSet, courseIds)} ${viol ? "violation" : ""}`}
                      title={viol ? viol.join(" · ") : ""} {...dragProps(c.id)} onClick={() => unplace(c.id)}>
                      <div className="code"><span>{c.id}</span><span className="tag">{c.credits} cr</span></div>
                      <div className="ttl">{c.title}</div>
                      {viol && <div className="viol-note">⚠ {viol[0]}</div>}
                    </div>
                  );
                })}
                {q.list.length === 0 && <div className="hint drop">drop here</div>}
              </div>
            );
          })}
        </div>
      </div>
      <p className="hint center">Tip: drag chips between quarters, or click a placed course to send it back. Auto-plan builds a prereq-valid path at ~15 cr/quarter.</p>
    </div>
  );
}

// ---- remaining-courses list ------------------------------------------------
function RemainingList({ courses, completedSet, courseIds }) {
  const remaining = courses.filter((c) => !completedSet.has(c.id));
  if (remaining.length === 0) return null;
  return (
    <>
      <div className="section-title">Still needed for this major ({remaining.length})</div>
      <div className="req-grid">
        {remaining.map((c) => {
          const st = statusOf(c, completedSet, courseIds);
          const need = c.prereqs.filter((p) => courseIds.has(p) && !completedSet.has(p));
          return (
            <div key={c.id} className="island req-card">
              <div className="code">{c.id}</div>
              <div className="ttl">{c.title}</div>
              <div className="meta">{CATEGORY_LABELS[c.category]} · {c.credits} cr</div>
              <div className={`status ${st}`}>{st === "avail" ? "Ready to take now" : `Needs: ${need.join(", ")}`}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---- app -------------------------------------------------------------------
export default function App() {
  const [majorId, setMajorId] = useState(null);
  const [studentId, setStudentId] = useState("");
  const [completed, setCompleted] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState(null);
  const [view, setView] = useState("planner");

  const major = majorId ? MAJORS[majorId] : null;
  const courseIds = useMemo(() => new Set(major ? major.courses.map((c) => c.id) : []), [major]);
  const completedSet = useMemo(() => new Set(completed), [completed]);

  const stats = useMemo(() => {
    if (!major) return null;
    const total = major.courses.length;
    const done = major.courses.filter((c) => completedSet.has(c.id)).length;
    const avail = major.courses.filter((c) => !completedSet.has(c.id) && statusOf(c, completedSet, courseIds) === "avail").length;
    return { total, done, avail, locked: total - done - avail, pct: Math.round((done / total) * 100) };
  }, [major, completedSet, courseIds]);

  async function handleSync() {
    if (!majorId) return;
    setSyncing(true);
    const res = await fetchCompletedCourses({ studentId: studentId || "demo-student", majorId });
    setCompleted(res.completed);
    setSyncedAt(new Date());
    setSyncing(false);
  }
  function pickMajor(id) { setMajorId(id); setCompleted([]); setSyncedAt(null); }

  return (
    <>
      <div className="bg-blob b1" /><div className="bg-blob b2" /><div className="bg-blob b3" />
      <div className="app">
        <header className="island topbar">
          <div className="brand">
            <div className="logo">🪐</div>
            <div><h1>Liquid Planner</h1><p>{UNIVERSITY.name} · Quarter system · Catalog {UNIVERSITY.catalogYear}</p></div>
          </div>
          <div className="who"><b>{studentId || "Guest"}</b>{syncedAt ? `Synced ${syncedAt.toLocaleTimeString()}` : "Not connected"}</div>
        </header>

        <section className="island picker">
          <h2>Choose your major</h2>
          <p className="sub">Pick a degree to load its minimum required courses, prerequisites, and pathways.</p>
          <div className="major-grid">
            {Object.values(MAJORS).map((m) => (
              <button key={m.id} className={`major-card ${majorId === m.id ? "active" : ""}`} onClick={() => pickMajor(m.id)}>
                <h3>{m.name}</h3><span>{m.school}</span>
              </button>
            ))}
          </div>
        </section>

        {major && (
          <>
            <section className="island signin">
              <input placeholder="School ID (e.g. UW NetID) — demo, no real auth" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
              <button className="btn" onClick={handleSync} disabled={syncing}>{syncing ? "Connecting…" : "Connect & pull transcript"}</button>
              {syncedAt && !syncing && <span className="synced">● Transcript synced — {completed.length} courses imported</span>}
            </section>

            {stats && (
              <section className="stats">
                <div className="island stat"><div className="num">{stats.pct}%</div><div className="lbl">Toward {major.name}</div>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${stats.pct}%` }} /></div></div>
                <div className="island stat"><div className="num">{stats.done}</div><div className="lbl">Completed</div></div>
                <div className="island stat"><div className="num">{stats.avail}</div><div className="lbl">Available now</div></div>
                <div className="island stat"><div className="num">{stats.locked}</div><div className="lbl">Prereqs pending</div></div>
              </section>
            )}

            <div className="toolbar">
              <div className="island segmented">
                <button className={view === "planner" ? "active" : ""} onClick={() => setView("planner")}>Quarter planner</button>
                <button className={view === "graph" ? "active" : ""} onClick={() => setView("graph")}>Pathway graph</button>
              </div>
              <div className="legend">
                <span><i className="dot done" /> Completed</span>
                <span><i className="dot avail" /> Available now</span>
                <span><i className="dot locked" /> Prereqs pending</span>
              </div>
            </div>

            {view === "planner"
              ? <QuarterPlanner major={major} courses={major.courses} completedSet={completedSet} courseIds={courseIds} />
              : <GraphView courses={major.courses} completedSet={completedSet} courseIds={courseIds} />}

            <RemainingList courses={major.courses} completedSet={completedSet} courseIds={courseIds} />

            <p className="footnote">
              Prototype overview · UW quarter system · Required courses & prerequisites are sample UW CS data.<br />
              Transcript sync, minors, double majors, and live catalog scraping arrive in later versions.<br />
              Designed to sync in real time with the companion SwiftUI iOS app.
            </p>
          </>
        )}
        {!major && <p className="footnote">Select a major above to generate your personalized planner.</p>}
      </div>
    </>
  );
}
