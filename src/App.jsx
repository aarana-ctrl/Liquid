import React, { useMemo, useState, useEffect } from "react";
import {
  UNIVERSITY, MAJORS, COURSES, CATEGORY_LABELS,
  fetchMyPlanSnapshot, STUDENT_SNAPSHOT, parseTranscript,
} from "./data.js";

// ---- quarter calendar ------------------------------------------------------
const TERMS = ["Autumn", "Winter", "Spring"];
const QUARTERS = [];
for (let y = 1; y <= 4; y++) for (const t of TERMS) QUARTERS.push({ idx: QUARTERS.length, term: t, year: y });
const FULL_TIME_MIN = 12, NORMAL_MAX = 18;

const CAT_VAR = {
  intro: "var(--cat-intro)", math: "var(--cat-math)", core: "var(--cat-core)",
  core400: "var(--cat-core400)", science: "var(--cat-science)",
  arts: "var(--cat-arts)", social: "var(--cat-social)", english: "var(--cat-english)", diversity: "var(--cat-diversity)",
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

// ---- graph layout ----------------------------------------------------------
function layoutGraph(ids) {
  const cache = {};
  const depth = (id, seen = new Set()) => {
    if (cache[id] != null) return cache[id];
    if (seen.has(id)) return 0; seen.add(id);
    const ps = (COURSES[id].prereqs || []).filter((p) => ids.has(p));
    const d = ps.length === 0 ? 0 : 1 + Math.max(...ps.map((p) => depth(p, seen)));
    cache[id] = d; return d;
  };
  const cols = {};
  ids.forEach((id) => { const d = depth(id); (cols[d] = cols[d] || []).push(id); });
  const COL_W = 200, ROW_H = 92, NODE_W = 146, NODE_H = 70, PAD = 14;
  const pos = {}; let maxRows = 0;
  Object.keys(cols).forEach((d) => {
    const list = cols[d].sort((a, b) => COURSES[a].category.localeCompare(COURSES[b].category));
    maxRows = Math.max(maxRows, list.length);
    list.forEach((id, row) => { pos[id] = { x: PAD + d * COL_W, y: PAD + row * ROW_H }; });
  });
  return { pos, width: PAD * 2 + Object.keys(cols).length * COL_W, height: PAD * 2 + maxRows * ROW_H, NODE_W, NODE_H, depth };
}

function GraphView({ planIds, completedSet, ipSet }) {
  const ids = useMemo(() => [...planIds], [planIds]);
  const { pos, width, height, NODE_W, NODE_H } = useMemo(() => layoutGraph(planIds), [planIds]);
  const edges = [];
  ids.forEach((id) => (COURSES[id].prereqs || []).filter((p) => planIds.has(p)).forEach((p) => {
    const a = pos[p], b = pos[id];
    if (a && b) edges.push({ key: `${p}-${id}`, x1: a.x + NODE_W, y1: a.y + NODE_H / 2, x2: b.x, y2: b.y + NODE_H / 2 });
  }));
  return (
    <div className="island graph-wrap">
      <div className="graph-inner" style={{ width, height }}>
        <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {edges.map((e) => { const mx = (e.x1 + e.x2) / 2;
            return <path key={e.key} d={`M ${e.x1} ${e.y1} C ${mx} ${e.y1}, ${mx} ${e.y2}, ${e.x2} ${e.y2}`} fill="none" stroke="var(--edge)" strokeWidth="1.5" />; })}
        </svg>
        {ids.map((id) => { const c = COURSES[id]; const st = statusOf(id, completedSet, ipSet, planIds); const p = pos[id];
          return (
            <div key={id} className={`node s-${st}`} style={{ left: p.x, top: p.y, width: NODE_W }}>
              <div className="code"><span>{id}</span><span className="pill">{st === "done" ? "✓" : st === "ip" ? "◐" : st === "avail" ? "•" : "🔒"}</span></div>
              <div className="cat-bar" style={{ background: CAT_VAR[c.category] }} />
              <div className="ttl">{c.title}</div>
            </div>
          ); })}
      </div>
    </div>
  );
}

// ---- requirement buckets + course picker -----------------------------------
function Requirements({ major, completedSet, ipSet, chosenSet, toggleCompleted, addChosen, removeChosen }) {
  const [open, setOpen] = useState({});
  return (
    <div className="reqs">
      {major.requirements.map((r) => {
        if (r.kind === "info") {
          return (
            <div className="island req-bucket" key={r.id}>
              <div className="rb-head"><div><div className="rb-title">{r.label} {r.met && <span className="met">✓ met</span>}</div>
                <div className="rb-sub">{r.note}</div></div></div>
            </div>
          );
        }
        const all = r.kind === "all";
        const fulfilling = all ? r.courses : r.courses.filter((id) => completedSet.has(id) || ipSet.has(id) || chosenSet.has(id));
        const doneCr = fulfilling.filter((id) => completedSet.has(id)).reduce((s, id) => s + COURSES[id].credits, 0);
        const ipCr = fulfilling.filter((id) => ipSet.has(id)).reduce((s, id) => s + COURSES[id].credits, 0);
        const planCr = fulfilling.filter((id) => chosenSet.has(id) && !completedSet.has(id) && !ipSet.has(id)).reduce((s, id) => s + COURSES[id].credits, 0);
        const doneCount = fulfilling.filter((id) => completedSet.has(id) || ipSet.has(id)).length;

        let need, have, unit;
        if (r.kind === "credits") { need = r.needCredits; have = doneCr + ipCr + planCr; unit = "cr"; }
        else if (r.kind === "choose") { need = r.needCount; have = fulfilling.length; unit = "courses"; }
        else { need = r.courses.length; have = doneCount; unit = "courses"; }
        const pct = Math.min(100, Math.round((have / need) * 100));
        const met = have >= need;
        const candidates = r.courses.filter((id) => !completedSet.has(id) && !ipSet.has(id) && !chosenSet.has(id));
        const picker = r.kind !== "all";

        return (
          <div className="island req-bucket" key={r.id}>
            <div className="rb-head">
              <div>
                <div className="rb-title">{r.label} {met && <span className="met">✓ met</span>}</div>
                <div className="rb-sub">
                  {r.kind === "credits" ? `${doneCr} done · ${ipCr} in-progress · ${planCr} planned` : `${doneCount} done/in-progress`} · need {need} {unit === "cr" ? "cr" : unit}
                </div>
              </div>
              <div className="rb-count">{have}/{need}{unit === "cr" ? " cr" : ""}</div>
            </div>
            <div className="rb-bar"><div className="rb-fill" style={{ width: `${pct}%`, background: met ? "var(--done)" : "var(--avail)" }} /></div>

            <div className="rb-chips">
              {fulfilling.map((id) => { const c = COURSES[id]; const done = completedSet.has(id); const ip = ipSet.has(id);
                return (
                  <span key={id} className={`chip ${done ? "done" : ip ? "ip" : "planned"}`}>
                    <i className="d" style={{ background: CAT_VAR[c.category] }} />
                    <b onClick={() => toggleCompleted(id)} title="Toggle completed">{id}</b>
                    <span className="cr">{c.credits}</span>
                    {!all && !done && !ip && <button className="x" onClick={() => removeChosen(id)} title="Remove">×</button>}
                  </span>
                ); })}
              {fulfilling.length === 0 && <span className="rb-empty">Nothing selected yet.</span>}
            </div>

            {picker && (
              <>
                <button className="rb-browse" onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))}>
                  {open[r.id] ? "▾ Hide" : "▸ Browse"} qualifying courses ({candidates.length})
                </button>
                {open[r.id] && (
                  <div className="rb-options">
                    {candidates.map((id) => { const c = COURSES[id];
                      return (
                        <div className="opt" key={id}>
                          <i className="d" style={{ background: CAT_VAR[c.category] }} />
                          <div className="opt-name"><b>{id}</b><span>{c.title}</span></div>
                          <span className="cr">{c.credits} cr</span>
                          <button className="add" onClick={() => addChosen(id)}>＋ Add</button>
                        </div>
                      ); })}
                    {candidates.length === 0 && <div className="rb-empty">No more qualifying courses listed.</div>}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- quarter planner -------------------------------------------------------
function QuarterPlanner({ planIds, completedSet, ipSet }) {
  const planArr = useMemo(() => [...planIds], [planIds]);
  const satisfied = useMemo(() => new Set([...completedSet, ...ipSet]), [completedSet, ipSet]);
  const completedCredits = planArr.filter((id) => completedSet.has(id)).reduce((s, id) => s + COURSES[id].credits, 0);
  const remaining = planArr.filter((id) => !completedSet.has(id) && !ipSet.has(id));

  const [schedule, setSchedule] = useState({});
  const [dragId, setDragId] = useState(null);
  useEffect(() => { setSchedule((s) => { const n = {}; for (const k in s) if (remaining.includes(k)) n[k] = s[k]; return n; }); }, [planArr.join(","), completedCredits]); // eslint-disable-line

  const pool = remaining.filter((id) => schedule[id] == null);
  const place = (id, q) => setSchedule((s) => ({ ...s, [id]: q }));
  const unplace = (id) => setSchedule((s) => { const n = { ...s }; delete n[id]; return n; });

  function violationFor(id) {
    const q = schedule[id]; if (q == null) return null; const miss = [];
    (COURSES[id].prereqs || []).filter((p) => planIds.has(p)).forEach((p) => {
      if (satisfied.has(p)) return;
      const pq = schedule[p];
      if (pq == null) miss.push(`${p} not planned`); else if (pq >= q) miss.push(`${p} must be earlier`);
    });
    return miss.length ? miss : null;
  }

  const qData = QUARTERS.map((qd) => {
    const list = remaining.filter((id) => schedule[id] === qd.idx);
    return { ...qd, list, credits: list.reduce((s, id) => s + COURSES[id].credits, 0) };
  });
  let run = completedCredits; const cum = qData.map((q) => (run += q.credits));
  const planned = qData.reduce((s, q) => s + q.credits, 0);
  const lastUsed = qData.reduce((m, q, i) => (q.list.length ? i : m), -1);
  const grad = lastUsed >= 0 ? QUARTERS[lastUsed] : null;

  function autoPlan() {
    const { depth } = layoutGraph(planIds);
    const order = [...remaining].sort((a, b) => depth(a) - depth(b) || COURSES[b].credits - COURSES[a].credits);
    const placed = {}, load = QUARTERS.map(() => 0), target = 15;
    order.forEach((id) => {
      let earliest = 0;
      (COURSES[id].prereqs || []).filter((p) => planIds.has(p)).forEach((p) => {
        if (satisfied.has(p)) return; if (placed[p] != null) earliest = Math.max(earliest, placed[p] + 1);
      });
      let q = earliest;
      while (q < QUARTERS.length && load[q] + COURSES[id].credits > target && load[q] >= target - 3) q++;
      if (q >= QUARTERS.length) q = QUARTERS.length - 1;
      placed[id] = q; load[q] += COURSES[id].credits;
    });
    setSchedule(placed);
  }

  const drag = (id) => ({ draggable: true, onDragStart: () => setDragId(id), onDragEnd: () => setDragId(null) });
  const drop = (h) => ({ onDragOver: (e) => e.preventDefault(), onDrop: (e) => { e.preventDefault(); if (dragId) h(dragId); setDragId(null); } });

  return (
    <div className="planner">
      <div className="island planner-summary">
        <div className="ps-item"><div className="num">{completedCredits}</div><div className="lbl">Credits done</div></div>
        <div className="ps-item"><div className="num">{planned}</div><div className="lbl">Credits planned</div></div>
        <div className="ps-item"><div className="num">{completedCredits + planned}</div><div className="lbl">Projected total</div></div>
        <div className="ps-item"><div className="num">{grad ? `${grad.term} Y${grad.year}` : "—"}</div><div className="lbl">Projected finish</div></div>
        <div className="ps-actions">
          <button className="btn" onClick={autoPlan}>Auto-plan path</button>
          <button className="btn ghost" onClick={() => setSchedule({})}>Clear</button>
        </div>
      </div>
      <div className="planner-cols">
        <div className="island pool" {...drop(unplace)}>
          <h4>To place <small>{pool.length}</small></h4>
          <p className="hint">Drag a course into a quarter →</p>
          {pool.map((id) => { const c = COURSES[id];
            return (
              <div key={id} className={`course-chip s-${statusOf(id, completedSet, ipSet, planIds)}`} {...drag(id)}>
                <div className="code"><span>{id}</span><span className="tag">{c.credits} cr</span></div>
                <div className="ttl">{c.title}</div>
              </div>
            ); })}
          {pool.length === 0 && <div className="hint">All planned courses placed ✓</div>}
        </div>
        <div className="quarters-scroll">
          {qData.map((q, i) => { const over = q.credits > NORMAL_MAX, under = q.credits > 0 && q.credits < FULL_TIME_MIN;
            return (
              <div key={q.idx} className="island q-col" {...drop((id) => place(id, q.idx))}>
                <div className="q-head"><div className="q-title">{q.term} <small>Yr {q.year}</small></div>
                  <div className={`q-credits ${over ? "over" : under ? "under" : ""}`}>{q.credits} cr</div></div>
                <div className="q-bar"><div className="q-bar-fill" style={{ width: `${Math.min(100, (q.credits / NORMAL_MAX) * 100)}%` }} /></div>
                <div className="q-cum">Σ {cum[i]} cr</div>
                {q.list.map((id) => { const c = COURSES[id]; const viol = violationFor(id);
                  return (
                    <div key={id} className={`course-chip s-${statusOf(id, completedSet, ipSet, planIds)} ${viol ? "violation" : ""}`}
                      title={viol ? viol.join(" · ") : ""} {...drag(id)} onClick={() => unplace(id)}>
                      <div className="code"><span>{id}</span><span className="tag">{c.credits} cr</span></div>
                      <div className="ttl">{c.title}</div>
                      {viol && <div className="viol-note">⚠ {viol[0]}</div>}
                    </div>
                  ); })}
                {q.list.length === 0 && <div className="hint drop">drop here</div>}
              </div>
            ); })}
        </div>
      </div>
      <p className="hint center">Drag chips between quarters, or click a placed course to send it back. Auto-plan builds a prereq-valid path at ~15 cr/quarter.</p>
    </div>
  );
}

// ---- app -------------------------------------------------------------------
export default function App() {
  const [majorId] = useState("cs"); // one real major loaded from MyPlan
  const [completed, setCompleted] = useState([]);
  const [inProgress, setInProgress] = useState([]);
  const [chosen, setChosen] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [view, setView] = useState("requirements");

  const major = MAJORS[majorId];
  const completedSet = useMemo(() => new Set(completed), [completed]);
  const ipSet = useMemo(() => new Set(inProgress), [inProgress]);
  const chosenSet = useMemo(() => new Set(chosen), [chosen]);
  const planIds = useMemo(() => buildPlanIds(major, completedSet, ipSet, chosenSet), [major, completedSet, ipSet, chosenSet]);

  const computed = useMemo(() => {
    const ids = [...planIds];
    const avail = ids.filter((id) => statusOf(id, completedSet, ipSet, planIds) === "avail").length;
    const locked = ids.filter((id) => statusOf(id, completedSet, ipSet, planIds) === "locked").length;
    return { avail, locked };
  }, [planIds, completedSet, ipSet]);

  async function handleSync() {
    setSyncing(true);
    const snap = await fetchMyPlanSnapshot();
    setSnapshot(snap);
    setCompleted((p) => [...new Set([...p, ...snap.earned])]);
    setInProgress((p) => [...new Set([...p, ...snap.inProgress])]);
    setSyncing(false);
  }
  function applyPaste() {
    const ids = parseTranscript(pasteText);
    setCompleted((p) => [...new Set([...p, ...ids])]);
    setShowPaste(false); setPasteText("");
  }
  function toggleCompleted(id) { setCompleted((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]); }
  const addChosen = (id) => setChosen((p) => p.includes(id) ? p : [...p, id]);
  const removeChosen = (id) => setChosen((p) => p.filter((x) => x !== id));

  const a = snapshot?.audit;
  const pct = a ? Math.round((a.earned / a.totalRequired) * 100) : 0;

  return (
    <div className="app">
      <header className="island topbar">
        <div className="brand">
          <div className="logo">🪐</div>
          <div><h1>Liquid Planner</h1><p>{UNIVERSITY.name} · Quarter system · Catalog {snapshot?.catalogYear || UNIVERSITY.catalogYear}</p></div>
        </div>
        <div className="who"><b>{snapshot?.preparedFor || "Not connected"}</b>{snapshot ? snapshot.source : "Connect MyPlan to load your audit"}</div>
      </header>

      <section className="island signin">
        <div className="signin-label"><b>{major.name}</b><span>{major.school}</span></div>
        <button className="btn" onClick={handleSync} disabled={syncing}>{syncing ? "Reading MyPlan…" : "Connect & pull from MyPlan (DARS)"}</button>
        <button className="btn ghost" onClick={() => setShowPaste((v) => !v)}>Paste transcript</button>
      </section>
      {showPaste && (
        <section className="island paste">
          <p className="hint">Paste your DARS / unofficial-transcript text — we detect course codes like “CSE 121”, “MATH 126”.</p>
          <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="e.g.  CSE 121  4.0  A …" />
          <button className="btn" onClick={applyPaste}>Import detected courses</button>
        </section>
      )}

      {a && (
        <section className="island audit-banner">
          <div className="ab-prog">
            <div className="ab-ring" style={{ "--p": pct }}><span>{pct}%</span></div>
            <div><div className="ab-title">{snapshot.program}</div><div className="ab-sub">Catalog {snapshot.catalogYear} · GPA {snapshot.gpa} · live from DARS</div></div>
          </div>
          <div className="ab-nums">
            <div><b>{a.earned}</b><span>earned</span></div>
            <div><b>{a.inProgress}</b><span>in progress</span></div>
            <div><b>{a.needs}</b><span>still needed</span></div>
            <div><b>{a.totalRequired}</b><span>required</span></div>
          </div>
        </section>
      )}

      {!a && <section className="stats"><div className="island stat" style={{ gridColumn: "1/-1" }}>
        <div className="lbl">Click “Connect & pull from MyPlan” to load your real degree audit — completed courses, credits, and remaining requirements by category.</div></div></section>}

      <div className="toolbar">
        <div className="island segmented">
          <button className={view === "requirements" ? "active" : ""} onClick={() => setView("requirements")}>Progress &amp; Requirements</button>
          <button className={view === "planner" ? "active" : ""} onClick={() => setView("planner")}>Quarter planner</button>
          <button className={view === "graph" ? "active" : ""} onClick={() => setView("graph")}>Pathway graph</button>
        </div>
        <div className="legend">
          <span><i className="dot done" /> Completed</span><span><i className="dot ip" /> In progress</span>
          <span><i className="dot avail" /> Available</span><span><i className="dot locked" /> Locked</span>
        </div>
      </div>

      {view === "requirements" && (
        <Requirements major={major} completedSet={completedSet} ipSet={ipSet} chosenSet={chosenSet}
          toggleCompleted={toggleCompleted} addChosen={addChosen} removeChosen={removeChosen} />
      )}
      {view === "planner" && <QuarterPlanner planIds={planIds} completedSet={completedSet} ipSet={ipSet} />}
      {view === "graph" && <GraphView planIds={planIds} completedSet={completedSet} ipSet={ipSet} />}

      <p className="footnote">
        {computed.avail} courses available to take now · {computed.locked} blocked by prerequisites.<br />
        Data pulled live from UW MyPlan (DARS audit + course search) via the Claude in Chrome extension while you were signed in.<br />
        Click a course code to toggle it · add gen-ed / elective courses from each requirement's “Browse” list · designed to sync with the SwiftUI iOS app.
      </p>
    </div>
  );
}
