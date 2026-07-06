// Recommendation engine for degree requirements.
//
// Core idea (per the product spec): a class is worth more when it knocks down
// MORE of the requirements you still need at once. A course that counts for
// Natural Science AND clears Diversity AND Writing beats one that only clears
// two — breadth of still-needed coverage is the dominant signal, then credit
// fit to what's left, then degree relevance.
import { COURSES } from "./data.js";

export const AREA_LABEL = {
  arts: "Arts & Humanities", social: "Social Sciences", science: "Natural Sciences",
  diversity: "Diversity", writing: "Writing (W)", core400: "Advanced CSE",
};

// A course's gen-ed areas (primary credit areas + overlays like DIV/W).
const areasOf = (c) => c.gened || [c.category];

export function poolForArea(area) {
  return Object.values(COURSES).filter((c) => areasOf(c).includes(area));
}

// Remaining need per requirement area: { area: { kind, need, have, remaining } }
export function computeRemaining(major, completedSet, ipSet, chosenSet) {
  const taken = new Set([...completedSet, ...ipSet]);
  const map = {};
  for (const r of major.requirements) {
    if (!r.area) continue;
    const pool = poolForArea(r.area);
    const counted = pool.filter((c) => taken.has(c.id) || chosenSet.has(c.id));
    if (r.kind === "credits") {
      const have = counted.reduce((s, c) => s + c.credits, 0);
      map[r.area] = { kind: "credits", need: r.needCredits, have, remaining: Math.max(0, r.needCredits - have), label: r.label };
    } else if (r.kind === "choose") {
      map[r.area] = { kind: "choose", need: r.needCount, have: counted.length, remaining: Math.max(0, r.needCount - counted.length), label: r.label };
    }
  }
  return map;
}

// Rank the courses that count toward `area`, given the full remaining map so we
// can reward breadth of coverage across everything still needed.
export function recommend({ area, remainingMap, taken, planned, satisfied }) {
  const pool = poolForArea(area).filter((c) => !taken.has(c.id));

  return pool
    .map((c) => {
      let score = 0;
      const reasons = [];

      // PRIMARY: how much of what you STILL NEED this course actually covers.
      // Areas you've already satisfied contribute nothing — so a course covering
      // two areas you need beats one covering three areas where two are done.
      let needValue = 0; const coveredNeeded = [];
      for (const g of areasOf(c)) {
        const rem = remainingMap[g];
        if (rem && rem.remaining > 0) {
          coveredNeeded.push(g);
          needValue += rem.kind === "credits" ? Math.min(c.credits, rem.remaining) : 4; // credits it knocks down (or ~4 for a course req)
        }
      }
      score += needValue * 4;
      if (coveredNeeded.length > 1) {
        score += 12 * (coveredNeeded.length - 1); // modest breadth bonus among NEEDED areas only
        reasons.push(`Covers ${coveredNeeded.length} things you still need — ${coveredNeeded.map((o) => AREA_LABEL[o] || o).join(" + ")}`);
      } else if (coveredNeeded.length === 1) {
        reasons.push(`Counts toward ${AREA_LABEL[coveredNeeded[0]] || coveredNeeded[0]}`);
      } else {
        reasons.push("Doesn't fill anything you still need (would double-count / elective)");
      }

      // degree relevance (minor tiebreaker)
      if (c.csRelevant && coveredNeeded.length) { score += 6; reasons.push(c.relevanceNote || "Relevant to your major"); }

      // prerequisite readiness
      const prereqs = c.prereqs || [];
      if (!prereqs.length) score += 2;
      else if (prereqs.every((p) => !COURSES[p] || satisfied?.has(p))) { score += 1; reasons.push("Prerequisites met"); }
      else { score -= 8; reasons.push("Has unmet prerequisites"); }

      if (planned?.has(c.id)) { score -= 100; reasons.unshift("Already in your plan"); }

      return { id: c.id, score, reasons, covers: Math.max(1, coveredNeeded.length), planned: !!planned?.has(c.id) };
    })
    .sort((a, b) => b.score - a.score);
}

// --- Compare mode: how much is left for a given major, from your transcript ---
export function compareProgram(program, completedSet, ipSet) {
  const remMap = computeRemaining(program, completedSet, ipSet, new Set());
  const prog = degreeProgress(program, completedSet, ipSet);
  const taken = new Set([...completedSet, ...ipSet]);
  const cats = [];
  for (const r of program.requirements) {
    if (r.kind === "credits") {
      const m = remMap[r.area];
      // courses that satisfy this area (still-needed ones first) — for detailed view
      const pool = poolForArea(r.area).filter((c) => !taken.has(c.id)).map((c) => c.id);
      cats.push({ label: r.label.replace(/ —.*/, ""), need: r.needCredits, remaining: m.remaining, unit: "cr", courses: pool.slice(0, 12) });
    } else if (r.kind === "choose") {
      const m = remMap[r.area];
      const pool = poolForArea(r.area).filter((c) => !taken.has(c.id)).map((c) => c.id);
      cats.push({ label: r.label.replace(/ \(.*/, ""), need: r.needCount, remaining: m.remaining, unit: "courses", courses: pool.slice(0, 12) });
    } else if (r.kind === "all") {
      const done = r.courses.filter((id) => taken.has(id)).length;
      cats.push({ label: r.label, need: r.courses.length, remaining: r.courses.length - done, unit: "courses", courses: r.courses.filter((id) => !taken.has(id)) });
    }
  }
  return { id: program.id, name: program.name, total: prog.total, earned: prog.earned, remaining: prog.remaining, pct: prog.pct, cats };
}

// --- EXACT compare, straight from a captured DARS audit ---------------------
// Given a program's stored DARS audit (from the extension), build the same
// compare shape but with the real, per-category numbers DARS reported.
const SKIP_REQ = /University requires|minimum of \d+ academic|^Bachelor|^Minor\b|\bMINOR \(|Minimum (cumulative|graded)|Total credits|in residence|^Catalog|GPA$|grade point/i;

export function compareFromAudit(meta, audit) {
  const a = audit.audit || {};
  const isMinor = audit.level === "minor";

  // Full per-category breakdown straight from DARS (gen-ed + program-specific).
  const cats = (audit.requirements || [])
    .filter((r) => !SKIP_REQ.test(r.label) && (r.needsCr != null || r.needsCourses != null || r.earnedCr != null))
    .map((r) => {
      const isCourses = r.needsCourses != null && r.needsCr == null;
      const remaining = isCourses ? r.needsCourses : (r.needsCr || 0);
      const have = (r.earnedCr || 0) + (r.ipCr || 0);
      const need = isCourses ? r.needsCourses : (have + (r.needsCr || 0));
      return { label: r.label.replace(/\s*\(\d+ cr.*/i, "").slice(0, 130), need, remaining, unit: isCourses ? "courses" : "cr", detail: r.label, courses: [] };
    })
    .sort((x, y) => y.remaining - x.remaining);

  // Remaining, split by unit, summed from the categories DARS actually listed.
  const remCredits = cats.filter((c) => c.unit === "cr").reduce((s, c) => s + c.remaining, 0);
  const remCourses = cats.filter((c) => c.unit === "courses").reduce((s, c) => s + c.remaining, 0);

  let total, earned, remaining, pct;
  if (isMinor) {
    // The 180-credit headline is the whole degree, not the minor. Derive the
    // minor's numbers from its own credit categories.
    total = cats.filter((c) => c.unit === "cr").reduce((s, c) => s + (c.need || 0), 0)
      || Math.max(1, (a.earned || 0) + (a.inProgress || 0) + (a.needs || 0));
    remaining = remCredits;
    earned = Math.max(0, total - remaining);
    pct = total ? Math.round((earned / total) * 100) : 0;
  } else {
    total = a.totalRequired || 180;
    earned = a.earned ?? 0;
    remaining = a.needs ?? 0;
    pct = Math.round((earned / total) * 100);
  }
  return {
    id: meta.id, name: meta.name,
    total, earned, remaining, pct, remCredits, remCourses,
    cats, exact: true, level: audit.level, program: audit.program, catalogYear: audit.catalogYear,
  };
}

// Find a captured audit that matches a catalog program by name keywords.
export function findAudit(name, programs, level) {
  if (!programs) return null;
  const core = String(name).replace(/\s*\([^)]*\)\s*$/, "").replace(/\b(B\.?S\.?|B\.?A\.?|minor|major)\b/gi, "").trim().toLowerCase();
  if (!core) return null;
  for (const key of Object.keys(programs)) {
    const p = programs[key];
    if (level && p.level && p.level !== level) continue;
    const title = String(p.program || key).toLowerCase();
    if (title.includes(core) || core.includes(title.replace(/^(bachelor of (science|arts)|minor)\s*\(?/, "").replace(/\)$/, "").trim())) return p;
  }
  return null;
}

// Minor comparison: credits toward the minor come from courses in its departments.
export function compareMinor(minor, completedSet, ipSet) {
  const taken = [...new Set([...completedSet, ...ipSet])];
  const reqCredits = minor.reqCredits || 30;
  const depts = minor.depts || [];
  const have = depts.length
    ? taken.filter((id) => depts.some((d) => id.startsWith(d))).reduce((s, id) => s + (COURSES[id]?.credits || 0), 0)
    : 0;
  const capped = Math.min(have, reqCredits);
  return { id: minor.id, name: minor.name, reqCredits, have: capped, remaining: reqCredits - capped, estimated: depts.length === 0 };
}

// Global ranking across ALL open requirements (gen-ed + core) for the Add picker.
// Required core courses rank highest, then breadth of still-needed coverage.
export function recommendGlobal(program, completedSet, ipSet, chosenSet) {
  const taken = new Set([...completedSet, ...ipSet]);
  const remMap = computeRemaining(program, completedSet, ipSet, chosenSet);
  const requiredIds = new Set();
  const cands = new Set();
  for (const r of program.requirements) {
    if (r.kind === "all") r.courses.forEach((id) => { if (!taken.has(id)) { cands.add(id); requiredIds.add(id); } });
    if (r.area && (remMap[r.area]?.remaining ?? 0) > 0) poolForArea(r.area).forEach((c) => { if (!taken.has(c.id)) cands.add(c.id); });
  }
  return [...cands].map((id) => {
    const c = COURSES[id];
    const areas = c.gened || [c.category];
    const coveredNeeded = areas.filter((a) => (remMap[a]?.remaining ?? 0) > 0);
    let score = 0; const reasons = [];
    if (requiredIds.has(id)) { score += 40; reasons.push("Required for your major"); }
    if (coveredNeeded.length) {
      score += 18 + 26 * (coveredNeeded.length - 1);
      reasons.push(`Covers ${coveredNeeded.length} requirement${coveredNeeded.length > 1 ? "s" : ""} — ${coveredNeeded.map((a) => AREA_LABEL[a] || a).join(", ")}`);
    }
    if (c.csRelevant) { score += 15; reasons.push(c.relevanceNote || "Relevant to your major"); }
    if ((c.prereqs || []).length === 0) score += 2;
    if (chosenSet.has(id)) { score -= 40; reasons.unshift("Already in your plan"); }
    return { id, score, reasons, covers: coveredNeeded.length, required: requiredIds.has(id), areas };
  }).sort((a, b) => b.score - a.score);
}

// Degree progress that does NOT over-count credits past a category's requirement.
// Each requirement contributes at most its needed credits; leftover earned credits
// count only up to the free-elective allowance (180 − sum of requirement needs).
export function degreeProgress(program, completedSet, ipSet) {
  const taken = new Set([...completedSet, ...ipSet]);
  let reqNeed = 0, reqHave = 0; const counted = new Set();
  for (const r of program.requirements) {
    if (r.kind === "credits") {
      const inPool = poolForArea(r.area).filter((c) => taken.has(c.id));
      reqNeed += r.needCredits;
      reqHave += Math.min(inPool.reduce((s, c) => s + c.credits, 0), r.needCredits);
      inPool.forEach((c) => counted.add(c.id));
    } else if (r.kind === "choose") {
      const inPool = poolForArea(r.area).filter((c) => taken.has(c.id)).slice(0, r.needCount);
      reqNeed += r.needCount * 4;
      reqHave += Math.min(inPool.reduce((s, c) => s + c.credits, 0), r.needCount * 4);
      inPool.forEach((c) => counted.add(c.id));
    } else if (r.kind === "all") {
      reqNeed += r.courses.reduce((s, id) => s + (COURSES[id]?.credits || 0), 0);
      r.courses.filter((id) => taken.has(id)).forEach((id) => { reqHave += COURSES[id].credits; counted.add(id); });
    }
  }
  const total = program.totalCredits || 180;
  const electiveAllowance = Math.max(0, total - reqNeed);
  const allEarned = [...taken].reduce((s, id) => s + (COURSES[id]?.credits || 0), 0);
  const countedCr = [...counted].reduce((s, id) => s + (COURSES[id]?.credits || 0), 0);
  const electiveApplied = Math.min(Math.max(0, allEarned - countedCr), electiveAllowance);
  const earned = Math.min(total, Math.round(reqHave + electiveApplied));
  return { total, earned, pct: Math.round((earned / total) * 100), remaining: total - earned };
}

// "AI plan": greedily select gen-ed / elective courses that cover the most
// still-needed requirements, until the degree's open requirements are filled.
export function autoSelect(major, completedSet, ipSet, chosenSet) {
  const taken = new Set([...completedSet, ...ipSet]);
  const chosen = new Set(chosenSet);

  // mutable remaining (credits for credit reqs, count for choose reqs)
  const rem = {}, kind = {};
  const base = computeRemaining(major, completedSet, ipSet, chosen);
  for (const a in base) { rem[a] = base[a].remaining; kind[a] = base[a].kind; }

  const selected = [];
  for (let iter = 0; iter < 30; iter++) {
    const cands = Object.values(COURSES).filter((c) =>
      !taken.has(c.id) && !chosen.has(c.id) && areasOf(c).some((a) => (rem[a] ?? 0) > 0));
    let best = null, bestVal = 0;
    for (const c of cands) {
      const covered = areasOf(c).filter((a) => (rem[a] ?? 0) > 0);
      if (!covered.length) continue;
      let val = 0;
      for (const a of covered) val += kind[a] === "credits" ? Math.min(c.credits, rem[a]) : 4;
      val += 14 * (covered.length - 1);      // breadth bonus
      if (c.csRelevant) val += 3;
      if (val > bestVal) { bestVal = val; best = { c, covered }; }
    }
    if (!best) break;
    selected.push(best.c.id); chosen.add(best.c.id);
    for (const a of best.covered) rem[a] = Math.max(0, rem[a] - (kind[a] === "credits" ? best.c.credits : 1));
    if (Object.values(rem).every((v) => v <= 0)) break;
  }
  return selected;
}
