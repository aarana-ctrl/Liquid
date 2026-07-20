// ---------------------------------------------------------------------------
// Liquid planner engine — builds ON TOP of the existing scheduler.
//
// It adds three things the old scheduleAll() didn't do:
//   1. seriesOf()   — detect a course series (CSE 121 → 122 → 123, etc.)
//   2. fitCourses() — insert new courses into an EXISTING schedule, respecting
//                     prereqs + a per-quarter credit cap + a graduation horizon.
//   3. suggestions  — when something won't fit, propose concrete reforms
//                     ("move X later" / "drop elective Y") instead of failing.
// ---------------------------------------------------------------------------
import { COURSES } from "./data.js";

// --- quarter helpers (kept in sync with App.jsx) ----------------------------
const TERM_ORDER = { WI: 0, SP: 1, SU: 2, AU: 3 };
const ORDER_TERM = ["WI", "SP", "SU", "AU"];
const TERM_NAME = { AU: "Autumn", WI: "Winter", SP: "Spring", SU: "Summer" };
const absTerm = (abs) => ORDER_TERM[((abs % 4) + 4) % 4];
const absYear = (abs) => Math.floor(abs / 4);
const academicYear = (term, year) => (term === "WI" || term === "SP") ? year - 1 : year;
export function quarterLabel(abs) { const t = absTerm(abs); return `${TERM_NAME[t]} ${academicYear(t, absYear(abs))}`; }
export function nextQuarters(startAbs, n, includeSummer) {
  const out = []; let a = startAbs;
  while (out.length < n) { if (includeSummer || absTerm(a) !== "SU") out.push(a); a++; }
  return out;
}

const numOf = (id) => parseInt((String(id).match(/\d+/) || ["0"])[0], 10);
const subjOf = (id) => (String(id).match(/^[A-Z&]+/) || [""])[0];
const credits = (id) => COURSES[id]?.credits || 0;

// --- 1) series detection ----------------------------------------------------
// A series is a linear prerequisite chain of same-subject, closely-numbered
// courses (e.g. CSE 121 → 122 → 123). Returns the ordered ids (incl. `id`) or
// null if the course isn't part of one. Detection is a suggestion the user
// confirms, so it favours the tight consecutive sequence over sprawling trees.
export function seriesOf(id) {
  if (!COURSES[id]) return null;
  const subj = subjOf(id);
  const sameSubjPrereqs = (x) => (COURSES[x]?.prereqs || []).filter((p) => COURSES[p] && subjOf(p) === subj);
  const chain = [id];
  // extend backward through single same-subject prereqs
  let head = id;
  for (let g = 0; g < 8; g++) {
    const ps = sameSubjPrereqs(head).filter((p) => numOf(p) < numOf(head) && numOf(head) - numOf(p) <= 12);
    const prev = ps.sort((a, b) => numOf(b) - numOf(a))[0];
    if (!prev || chain.includes(prev)) break;
    chain.unshift(prev); head = prev;
  }
  // extend forward: the closest higher-numbered same-subject course that requires the tail
  let tail = id;
  for (let g = 0; g < 8; g++) {
    const cands = Object.keys(COURSES).filter((x) =>
      subjOf(x) === subj && !chain.includes(x) &&
      numOf(x) > numOf(tail) && numOf(x) - numOf(tail) <= 12 &&
      (COURSES[x].prereqs || []).includes(tail));
    const next = cands.sort((a, b) => numOf(a) - numOf(b))[0];
    if (!next) break;
    chain.push(next); tail = next;
  }
  return chain.length > 1 ? chain : null;
}

// --- 2) scheduling primitives ----------------------------------------------
function depthFn(ids) {
  const set = new Set(ids), cache = {};
  const d = (id, seen = new Set()) => {
    if (cache[id] != null) return cache[id];
    if (seen.has(id)) return 0; seen.add(id);
    const ps = (COURSES[id]?.prereqs || []).filter((p) => set.has(p));
    const v = ps.length ? 1 + Math.max(...ps.map((p) => d(p, seen))) : 0;
    cache[id] = v; return v;
  };
  return d;
}

// Insert `newIds` into an existing schedule. Returns:
//   { schedule, placed:[ids], unplaced:[ids], suggestions:[{...}] }
// `schedule` is id -> abs (quarter). completed/ip courses are fixed anchors.
export function fitCourses(newIds, opts) {
  const { schedule = {}, completed = new Set(), inProgress = new Set(),
    startAbs, horizon = 16, capCredits = 18, target = 15 } = opts;
  const done = new Set([...completed, ...inProgress]);
  const quarters = nextQuarters(startAbs, horizon, false);
  const qIndex = new Map(quarters.map((q, i) => [q, i]));

  // current load per quarter from the existing planned schedule
  const load = {}; quarters.forEach((q) => (load[q] = 0));
  const sched = { ...schedule };
  for (const [id, abs] of Object.entries(sched)) if (load[abs] != null) load[abs] += credits(id);

  const toAdd = [...new Set(newIds)].filter((id) => COURSES[id] && !done.has(id) && sched[id] == null);
  const order = toAdd.sort((a, b) => depthFn(toAdd)(a) - depthFn(toAdd)(b) || numOf(a) - numOf(b));

  // earliest quarter index a course is allowed in (after its prereqs)
  const earliestIdx = (id) => {
    let mi = 0;
    for (const p of (COURSES[id].prereqs || [])) {
      if (done.has(p)) continue;
      const pa = sched[p]; if (pa != null && qIndex.has(pa)) mi = Math.max(mi, qIndex.get(pa) + 1);
    }
    return mi;
  };

  const placed = [], unplaced = [];
  for (const id of order) {
    const cr = credits(id);
    let i = earliestIdx(id), slot = -1;
    for (; i < quarters.length; i++) { if (load[quarters[i]] + cr <= capCredits) { slot = i; break; } }
    if (slot === -1) { unplaced.push(id); continue; }
    // prefer the earliest quarter that stays under the soft target, else the hard cap slot
    let softer = slot;
    for (let j = earliestIdx(id); j <= slot; j++) if (load[quarters[j]] + cr <= target) { softer = j; break; }
    const q = quarters[softer]; sched[id] = q; load[q] += cr; placed.push(id);
  }

  const suggestions = unplaced.length ? reformsFor(unplaced, sched, load, quarters, qIndex, done, capCredits) : [];
  return { schedule: sched, placed, unplaced, suggestions };
}

// --- 3) reform suggestions --------------------------------------------------
// For each course that wouldn't fit, propose the smallest change that would:
//   • move a movable planned course to a later quarter with room, or
//   • drop a low-priority elective from a full quarter.
function reformsFor(unplaced, sched, load, quarters, qIndex, done, capCredits) {
  const out = [];
  const movable = (id) => !done.has(id) && sched[id] != null; // planned, not locked by DARS
  // electives / non-required first — heuristics: scraped or gen-ed pool courses
  const droppability = (id) => (COURSES[id]?.scraped ? 2 : 0) + (COURSES[id]?.gened ? 1 : 0) - (COURSES[id]?.csRelevant ? 1 : 0);

  for (const nid of unplaced) {
    const cr = credits(nid);
    const startI = 0; // (prereq window already checked in fitCourses; keep suggestions simple)
    // 1) a quarter where moving one movable course later frees enough room
    let best = null;
    for (let i = startI; i < quarters.length - 1; i++) {
      const q = quarters[i];
      const here = Object.keys(sched).filter((id) => sched[id] === q && movable(id));
      for (const mid of here) {
        // is there a later quarter with room for mid?
        for (let j = i + 1; j < quarters.length; j++) {
          if (load[quarters[j]] + credits(mid) <= capCredits) {
            const freed = credits(mid);
            if (freed + (capCredits - load[q]) >= cr) {
              const score = credits(mid); // prefer moving the smallest course
              if (!best || score < best.score) best = { type: "move", course: mid, from: q, to: quarters[j], forCourse: nid, score };
            }
            break;
          }
        }
      }
    }
    if (best) { out.push({ ...best, label: `Take ${fmt(nid)} by moving ${fmt(best.course)} from ${quarterLabel(best.from)} to ${quarterLabel(best.to)}.` }); continue; }
    // 2) drop the most-droppable planned course to make room somewhere
    const droppable = Object.keys(sched).filter(movable).sort((a, b) => droppability(b) - droppability(a));
    if (droppable.length) {
      const d = droppable[0];
      out.push({ type: "drop", course: d, forCourse: nid, label: `Take ${fmt(nid)} by dropping ${fmt(d)} (${COURSES[d]?.title || ""}).` });
    } else {
      out.push({ type: "none", forCourse: nid, label: `No room for ${fmt(nid)} in your remaining quarters — you'd need an extra quarter or a heavier load.` });
    }
  }
  return out;
}

const fmt = (id) => String(id).replace(/([A-Z&])(\d)/, "$1 $2");

// Total planned credits per quarter — handy for the UI to show load.
export function quarterLoad(schedule) {
  const load = {};
  for (const [id, abs] of Object.entries(schedule || {})) load[abs] = (load[abs] || 0) + credits(id);
  return load;
}
