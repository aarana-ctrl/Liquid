import React, { useMemo, useState, useEffect, useRef, useLayoutEffect } from "react";
import { UNIVERSITY, MAJORS, COURSES, CATEGORY_LABELS, fetchMyPlanSnapshot, parseTranscript } from "./data.js";
import { mockSignIn } from "./auth.js";
import { apiHealth, devLogin, getPlan, savePlan, getSnapshot, postSnapshot, startImport, importDars, me, oidcStartUrl, API_BASE } from "./api.js";
import { recommend, poolForArea, computeRemaining, autoSelect } from "./recommend.js";
import bgUrl from "./bg.jpg";

// ---- quarter calendar ------------------------------------------------------
const TERMS = ["Autumn", "Winter", "Spring"];
const QUARTERS = [];
for (let y = 1; y <= 4; y++) for (const t of TERMS) QUARTERS.push({ idx: QUARTERS.length, term: t });
const BASE_AUTUMN = 2026;
function qLabel(i) {
  const ti = i % 3, yo = Math.floor(i / 3);
  const year = ti === 0 ? BASE_AUTUMN + yo : BASE_AUTUMN + 1 + yo;
  return { term: TERMS[ti], year };
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
// Spread the remaining (non-completed, non-in-progress) courses across quarters,
// respecting prerequisites and a ~15 cr/quarter target.
function scheduleAll(planIds, completedSet, ipSet) {
  const remaining = [...planIds].filter((id) => !completedSet.has(id) && !ipSet.has(id));
  const depth = depthFn(planIds);
  const satisfied = new Set([...completedSet, ...ipSet]);
  const order = [...remaining].sort((a, b) => depth(a) - depth(b) || COURSES[b].credits - COURSES[a].credits);
  const placed = {}, load = QUARTERS.map(() => 0), target = 15;
  order.forEach((id) => {
    let earliest = 0;
    (COURSES[id].prereqs || []).filter((p) => planIds.has(p)).forEach((p) => { if (satisfied.has(p)) return; if (placed[p] != null) earliest = Math.max(earliest, placed[p] + 1); });
    let q = earliest;
    while (q < QUARTERS.length && load[q] + COURSES[id].credits > target && load[q] >= target - 3) q++;
    if (q >= QUARTERS.length) q = QUARTERS.length - 1;
    placed[id] = q; load[q] += COURSES[id].credits;
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

// ---- background (Lake Tahoe dusk photo behind the glass islands) ------------
function Sky() {
  return <div className="bg-photo" style={{ backgroundImage: `url(${bgUrl})` }} aria-hidden />;
}

// ---- assistant orb + radial dial -------------------------------------------
function AssistantOrb({ open, onToggle, items }) {
  const N = items.length, start = 200, end = 340, R = 92;
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
        <button className="prov apple" disabled={!!busy} onClick={() => go("apple")}><AppleLogo /><span>{busy === "apple" ? "Signing in…" : "Continue with Apple"}</span></button>
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
function PlanBoard({ major, snapshot, planIds, completedSet, ipSet, schedule, setSchedule, mode, setMode }) {
  const boardRef = useRef(null), colsRef = useRef(null), cardRefs = useRef({});
  const [edges, setEdges] = useState([]);
  const [dragId, setDragId] = useState(null);

  const ipArr = useMemo(() => [...ipSet].filter((id) => COURSES[id]), [ipSet]);
  const remaining = useMemo(() => [...planIds].filter((id) => !completedSet.has(id) && !ipSet.has(id)), [planIds, completedSet, ipSet]);
  const pool = remaining.filter((id) => schedule[id] == null);

  const maxUsed = remaining.reduce((m, id) => (schedule[id] != null ? Math.max(m, schedule[id]) : m), 0);
  const visible = Math.min(QUARTERS.length, Math.max(3, maxUsed + 2));

  const satisfied = useMemo(() => new Set([...completedSet, ...ipSet]), [completedSet, ipSet]);
  function violation(id) {
    const q = schedule[id]; if (q == null) return false;
    return (COURSES[id].prereqs || []).filter((p) => planIds.has(p)).some((p) => {
      if (satisfied.has(p)) return false; const pq = (ipSet.has(p) ? 0 : schedule[p]); return pq == null || pq >= q;
    });
  }
  const colContents = (c) => [
    ...(c === 0 ? ipArr : []),
    ...remaining.filter((id) => schedule[id] === c),
  ];
  const colCredits = (c) => colContents(c).reduce((s, id) => s + COURSES[id].credits, 0);

  const place = (id, c) => setSchedule((s) => ({ ...s, [id]: c }));
  const unplace = (id) => setSchedule((s) => { const n = { ...s }; delete n[id]; return n; });
  const drag = (id) => ({ draggable: true, onDragStart: () => setDragId(id), onDragEnd: () => setDragId(null) });
  const drop = (h) => ({ onDragOver: (e) => e.preventDefault(), onDrop: (e) => { e.preventDefault(); if (dragId) h(dragId); setDragId(null); } });

  // prerequisite connectors
  useLayoutEffect(() => {
    function compute() {
      const board = boardRef.current; if (!board) { setEdges([]); return; }
      const br = board.getBoundingClientRect(); const out = [];
      [...planIds].forEach((id) => {
        const a = cardRefs.current[id]; if (!a) return;
        (COURSES[id].prereqs || []).filter((p) => planIds.has(p)).forEach((p) => {
          const b = cardRefs.current[p]; if (!b) return;
          const ar = a.getBoundingClientRect(), pr = b.getBoundingClientRect();
          out.push({ key: `${p}-${id}`, x2: ar.left - br.left, y2: ar.top - br.top + ar.height / 2, x1: pr.right - br.left, y1: pr.top - br.top + pr.height / 2 });
        });
      });
      setEdges(out);
    }
    compute();
    const ro = new ResizeObserver(compute); if (boardRef.current) ro.observe(boardRef.current);
    const cols = colsRef.current; if (cols) cols.addEventListener("scroll", compute);
    window.addEventListener("resize", compute);
    return () => { ro.disconnect(); if (cols) cols.removeEventListener("scroll", compute); window.removeEventListener("resize", compute); };
  }, [planIds, schedule, mode, visible, ipArr.length]);

  function card(id, colIdx) {
    const ip = ipSet.has(id);
    const viol = violation(id);
    const cls = viol ? "locked violation" : ip ? "enrolled" : colIdx >= 2 ? "projected" : "planned";
    const label = viol ? "Prereq needed" : ip ? "Enrolled" : colIdx >= 2 ? "Projected" : "Planned";
    const c = COURSES[id];
    return (
      <div key={id} ref={(el) => (cardRefs.current[id] = el)} className={`ccard ${cls}`}
        {...(ip ? {} : drag(id))} onClick={() => !ip && unplace(id)} title={ip ? "" : "Click to unplace"}>
        <div className="ch"><span className="code">{id.replace(/(\d)/, " $1")}</span><span className="cr">{c.credits}cr</span></div>
        <div className="ttl">{c.title}</div>
        <div className="st"><i />{label}</div>
        {viol && <div className="viol">⚠ prerequisite not yet planned</div>}
      </div>
    );
  }

  return (
    <div className="island plan" ref={boardRef}>
      <div className="plan-head">
        <div className="plan-uni">
          <div className="uni-badge">W</div>
          <div><h3>{UNIVERSITY.name} ▾</h3><span>{major.name.replace(" (B.S.)", "")} · B.S.</span></div>
        </div>
        <div className="plan-head-right">
          <span className="yearsel">{snapshot?.catalogYear || "AU 25"} ▾</span>
          <div className="seg">
            <button className={mode === "plan" ? "active" : ""} onClick={() => setMode("plan")}>Plan</button>
            <button className={mode === "grid" ? "active" : ""} onClick={() => setMode("grid")}>Grid</button>
          </div>
        </div>
      </div>

      <div className="board">
        <svg className="connectors">
          {edges.map((e) => { const mx = (e.x1 + e.x2) / 2;
            return <path key={e.key} d={`M ${e.x1} ${e.y1} C ${mx} ${e.y1}, ${mx} ${e.y2}, ${e.x2} ${e.y2}`} fill="none" stroke="rgba(139,123,240,0.5)" strokeWidth="1.5" />; })}
        </svg>
        <div className="cols" ref={colsRef}>
          {Array.from({ length: visible }, (_, c) => {
            const lab = qLabel(c); const tag = c === 0 ? "In progress" : c === 1 ? "Planned" : "Projected";
            return (
              <div key={c} className="qcol" {...drop((id) => place(id, c))}>
                <div className="qcol-head"><h4>{lab.term} {lab.year}</h4><span className="cr">{colCredits(c)} cr</span></div>
                <div className="qcol-tag">{tag}</div>
                <div className="qcol-line" />
                {colContents(c).map((id) => card(id, c))}
                {colContents(c).length === 0 && <div className="empty">drop course</div>}
              </div>
            );
          })}
          {pool.length > 0 && (
            <div className="qcol" {...drop(unplace)}>
              <div className="qcol-head"><h4>Unscheduled</h4><span className="cr">{pool.length}</span></div>
              <div className="qcol-tag">To place</div>
              <div className="qcol-line" style={{ background: "linear-gradient(90deg, var(--text-faint), transparent)" }} />
              {pool.map((id) => card(id, 1))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- side cards ------------------------------------------------------------
function AuditCard({ major, snapshot, completedSet, onResync, syncing }) {
  const a = snapshot?.audit;
  const earned = a?.earned ?? 0, total = a?.totalRequired ?? major.totalCredits;
  const pct = Math.round((earned / total) * 100);
  return (
    <div className="island card">
      <div className="eyebrow">Degree Audit {I.grad}</div>
      <h3>{(snapshot?.program || major.name)}</h3>
      <div className="sub">College of Arts &amp; Sciences{snapshot ? ` · GPA ${snapshot.gpa}` : ""}</div>
      <div className="bar-row"><div className="bl"><span>Major</span><b>{pct}%</b></div><div className="bar"><div style={{ width: `${pct}%` }} /></div></div>
      <div className="card-foot">
        <span className="big">{earned} / {total} cr</span>
        <span className="ontrack"><i />{pct >= 100 ? "Complete" : "On track"}</span>
      </div>
      <button className="resync" onClick={onResync} disabled={syncing}>{syncing ? "Reading MyPlan…" : snapshot ? "Re-sync MyPlan (DARS)" : "Connect & pull from MyPlan"}</button>
    </div>
  );
}
function ThisQuarter({ ipSet }) {
  const list = [...ipSet].filter((id) => COURSES[id]);
  const cr = list.reduce((s, id) => s + COURSES[id].credits, 0);
  const l = qLabel(0);
  return (
    <div className="island card">
      <div className="eyebrow">This Quarter <span className="pill-sm">{cr} cr</span></div>
      <div style={{ marginTop: 12 }}>
        {list.map((id) => (
          <div key={id} className="tq-row"><i style={{ background: CAT_VAR[COURSES[id].category] }} /><span className="c">{id.replace(/(\d)/, " $1")}</span><span className="t">{COURSES[id].title}</span></div>
        ))}
        {list.length === 0 && <div className="rb-empty">No enrolled courses — connect MyPlan.</div>}
      </div>
      <div className="tq-foot"><span>{l.term} {l.year} · {list.length} courses</span><span>no conflicts</span></div>
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

// ---- MyPlan handoff modal (production import via bookmarklet) ---------------
function HandoffModal({ token, onClose, onImported, onDemo }) {
  const [code, setCode] = useState(null);
  const [status, setStatus] = useState("Generating a secure one-time link…");
  const [paste, setPaste] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await startImport(token);
      if (!alive) return;
      if (r?.code) { setCode(r.code); setStatus("Waiting for your MyPlan import…"); }
      else setStatus("Couldn't reach the backend. Use demo data or paste below.");
    })();
    return () => { alive = false; };
  }, [token]);

  useEffect(() => {
    if (!code) return;
    const iv = setInterval(async () => {
      const snap = await getSnapshot(token);
      if (snap && snap.source?.includes("imported")) { clearInterval(iv); onImported(snap); }
    }, 3000);
    return () => clearInterval(iv);
  }, [code, token]);

  const bm = code
    ? `javascript:(function(){fetch('${API_BASE}/api/import/${code}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({darsText:document.body.innerText})}).then(function(r){return r.json()}).then(function(j){alert('Liquid Planner: imported '+((j.audit&&j.audit.earned)||0)+' credits. Return to the app.')}).catch(function(){alert('Import failed — make sure you are on your DARS audit page.')})})();`
    : "#";

  async function submitPaste() {
    if (!code || !paste.trim()) return;
    const r = await importDars(code, paste);
    if (r?.ok) { const snap = await getSnapshot(token); if (snap) onImported(snap); }
  }

  return (
    <div className="cd-overlay" onClick={onClose}>
      <div className="island cd-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="cd-head">
          <div><div className="cd-title">Sync from MyPlan</div><div className="cd-sub">Pull your real DARS audit — your NetID never leaves UW.</div></div>
          <button className="cd-close" onClick={onClose}>×</button>
        </div>
        <div className="cd-body">
          <ol className="ho-steps">
            <li>Drag this button to your bookmarks bar (or copy it):<br />
              <a className="ho-bm" href={bm} onClick={(e) => e.preventDefault()} draggable>📥 Import to Liquid Planner</a>
              <button className="ho-copy" onClick={() => { navigator.clipboard?.writeText(bm); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied" : "Copy"}</button>
            </li>
            <li>Open <b>myplan.uw.edu/audit</b> and sign in with your UW NetID.</li>
            <li>Click the bookmarklet on your DARS page. This app picks it up automatically.</li>
          </ol>
          <div className="ho-status"><span className="spin" /> {status}</div>
          <details className="ho-paste">
            <summary>Paste DARS text instead</summary>
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Select-all + copy your DARS page, paste here…" />
            <button className="btn" onClick={submitPaste} disabled={!code || !paste.trim()}>Import pasted audit</button>
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
  const didAutoSync = useRef(false);

  const major = MAJORS.cs;
  const completedSet = useMemo(() => new Set(completed), [completed]);
  const ipSet = useMemo(() => new Set(inProgress), [inProgress]);
  const chosenSet = useMemo(() => new Set(chosen), [chosen]);
  const planIds = useMemo(() => buildPlanIds(major, completedSet, ipSet, chosenSet), [major, completedSet, ipSet, chosenSet]);

  useEffect(() => { apiHealth().then((j) => { setBackendOnline(!!j?.ok); setOidcEnabled(j?.oidc || {}); }); }, []);
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
        if (plan.schedule && Object.keys(plan.schedule).length) setSchedule(plan.schedule);
      }
      if (snap) setSnapshot(snap);
      setLoaded(true);
    })();
  }, [token]);
  useEffect(() => {
    if (!token || !loaded) return;
    const t = setTimeout(() => savePlan(token, { chosen, completed, inProgress, schedule }), 600);
    return () => clearTimeout(t);
  }, [token, loaded, chosen, completed, inProgress, schedule]);

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
    const adds = autoSelect(major, completedSet, ipSet, chosenSet);
    const newChosen = [...new Set([...chosen, ...adds])];
    // 2) schedule the whole plan across quarters
    const newPlan = buildPlanIds(major, completedSet, ipSet, new Set(newChosen));
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
    { key: "majors", label: "Majors", icon: I.grad, onClick: () => setView("catalog") },
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
        <button title="Profile">{I.user}</button>
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

        {showPaste && (
          <section className="island paste">
            <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "0 0 6px" }}>Paste your DARS / transcript text — we detect codes like “CSE 121”.</p>
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="CSE 121  4.0  A …" />
            <button className="btn" onClick={() => { setCompleted((p) => [...new Set([...p, ...parseTranscript(pasteText)])]); setShowPaste(false); setPasteText(""); }}>Import detected courses</button>
          </section>
        )}

        <div className="layout">
          <div>
            {view === "plan"
              ? <PlanBoard major={major} snapshot={snapshot} planIds={planIds} completedSet={completedSet} ipSet={ipSet} schedule={schedule} setSchedule={setSchedule} mode={mode} setMode={setMode} />
              : <Requirements major={major} completedSet={completedSet} ipSet={ipSet} chosenSet={chosenSet} toggleCompleted={toggleCompleted} removeChosen={removeChosen} onOpen={setDetailReq} />}
          </div>
          <div className="side">
            <AuditCard major={major} snapshot={snapshot} completedSet={completedSet} onResync={handleSync} syncing={syncing} />
            <ThisQuarter ipSet={ipSet} />
            <div className="island card" style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div><b style={{ fontSize: 13 }}>{user.name}</b><div style={{ fontSize: 11, color: "var(--text-dim)" }}>{user.email}</div></div>
              <button className="signout" onClick={() => { try { localStorage.removeItem("lp_session"); } catch { /* */ } didAutoSync.current = false; setUser(null); setToken(null); setLoaded(false); setSnapshot(null); setCompleted([]); setInProgress([]); setChosen([]); setSchedule({}); }}>Sign out</button>
            </div>
          </div>
        </div>

        <p className="footnote">Drag courses between quarters · click the orb for the assistant dial · data live from UW MyPlan (DARS) via the browser session, synced through the backend.</p>
      </div>

      <div className="toolbar island">
        <button onClick={() => setShowPaste((v) => !v)}>{I.pen}<span>Design</span></button>
        <button className="ic-btn" onClick={() => setView("catalog")}>{I.plus}</button>
        <div className="tb-sep" />
        <button onClick={() => setView("catalog")}>{I.grad}<span>Majors &amp; Minors</span></button>
        <button className="primary" onClick={autoPlan}>{I.spark}<span>Auto Plan</span></button>
        <button className="ic-btn" onClick={() => setSchedule({})}>{I.undo}</button>
      </div>

      {detailReq && (
        <CategoryDetail req={detailReq} major={major} completedSet={completedSet} ipSet={ipSet} chosenSet={chosenSet}
          addChosen={addChosen} removeChosen={removeChosen} onClose={() => setDetailReq(null)} />
      )}
      {showHandoff && (
        <HandoffModal token={token}
          onClose={() => setShowHandoff(false)}
          onImported={(snap) => { applySnapshot(snap); setShowHandoff(false); }}
          onDemo={() => { setShowHandoff(false); handleSyncLocal(); }} />
      )}
    </>
  );
}
