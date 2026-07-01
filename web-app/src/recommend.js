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
  const remThis = remainingMap[area]?.remaining ?? 0;
  const isCredits = (remainingMap[area]?.kind ?? "credits") === "credits";
  const pool = poolForArea(area).filter((c) => !taken.has(c.id));

  return pool
    .map((c) => {
      let score = 0;
      const reasons = [];

      // 1) breadth — how many *other still-needed* requirements this also covers
      const othersNeeded = areasOf(c).filter((g) => g !== area && (remainingMap[g]?.remaining ?? 0) > 0);
      const totalCovered = othersNeeded.length + 1;
      if (othersNeeded.length) {
        score += 30 + 30 * othersNeeded.length; // strong, super-linear preference for breadth
        reasons.push(`Covers ${totalCovered} requirements at once — also ${othersNeeded.map((o) => AREA_LABEL[o] || o).join(" + ")}`);
      }

      // 2) credit fit to what's left in this area
      if (isCredits && remThis > 0) {
        if (c.credits === remThis) { score += 40; reasons.push(`Exactly fills your remaining ${remThis} cr`); }
        else if (c.credits < remThis) { score += 26 - (remThis - c.credits); reasons.push(`${c.credits} cr toward ${remThis} cr left`); }
        else { score += 14 - (c.credits - remThis) * 2; reasons.push(`${c.credits} cr — over the ${remThis} cr left`); }
      } else { score += 6; }

      // 3) degree relevance
      if (c.csRelevant) { score += 18; reasons.push(c.relevanceNote || "Relevant to your major"); }

      // 4) prerequisite readiness
      const prereqs = c.prereqs || [];
      if (!prereqs.length) score += 3;
      else if (prereqs.every((p) => !COURSES[p] || satisfied?.has(p))) { score += 2; reasons.push("Prerequisites met"); }
      else { score -= 8; reasons.push("Has unmet prerequisites"); }

      // 5) de-prioritize what's already planned
      if (planned?.has(c.id)) { score -= 40; reasons.unshift("Already in your plan"); }

      return { id: c.id, score, reasons, covers: totalCovered, planned: !!planned?.has(c.id) };
    })
    .sort((a, b) => b.score - a.score);
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
