// Recommendation engine for a degree-requirement category.
//
// Inputs: the area (arts/social/science/diversity/core400…), how much is still
// needed, the courses already taken, and what's already planned. Output: every
// qualifying course ranked, each with human-readable reasons.
//
// Signals (matching the product spec):
//   • credit fit   — prefer a class whose credits match the remaining need
//   • multi-count  — a class that also satisfies another requirement is worth more
//   • degree fit   — CS-relevant classes get boosted
//   • history      — already-completed/in-progress classes are excluded
//   • prereq-ready — classes you can actually take now rank above locked ones
import { COURSES } from "./data.js";

const AREA_LABEL = {
  arts: "Arts & Humanities", social: "Social Sciences", science: "Natural Sciences",
  diversity: "Diversity", writing: "Writing (W)", core400: "Advanced CSE",
};

export function poolForArea(area) {
  return Object.values(COURSES).filter((c) => (c.gened || [c.category]).includes(area));
}

// taken/planned are Sets of course ids. satisfied = completed ∪ in-progress.
export function recommend({ area, remainingCredits = 0, taken, planned, satisfied }) {
  const pool = poolForArea(area).filter((c) => !taken.has(c.id));
  return pool
    .map((c) => {
      let score = 0;
      const reasons = [];

      // 1) credit fit (only meaningful for credit-based requirements)
      if (remainingCredits > 0) {
        if (c.credits === remainingCredits) { score += 45; reasons.push(`Exactly fills your remaining ${remainingCredits} cr`); }
        else if (c.credits < remainingCredits) { score += 30 - (remainingCredits - c.credits); reasons.push(`${c.credits} cr toward ${remainingCredits} cr left`); }
        else { score += 18 - (c.credits - remainingCredits) * 2; reasons.push(`${c.credits} cr — slightly over the ${remainingCredits} cr left`); }
      } else {
        score += 8;
      }

      // 2) double-counts toward another requirement
      const others = (c.gened || []).filter((g) => g !== area);
      if (others.length) { score += 24; reasons.push(`Also counts toward ${others.map((o) => AREA_LABEL[o] || o).join(" / ")}`); }

      // 3) degree relevance
      if (c.csRelevant) { score += 22; reasons.push(c.relevanceNote || "Relevant to your major"); }

      // 4) prerequisite readiness
      const prereqs = (c.prereqs || []);
      const ready = prereqs.every((p) => !COURSES[p] || satisfied?.has(p));
      if (!prereqs.length) { score += 4; }
      else if (ready) { score += 2; reasons.push("Prerequisites met"); }
      else { score -= 8; reasons.push("Has unmet prerequisites"); }

      // 5) de-prioritize what you've already planned
      if (planned?.has(c.id)) { score -= 40; reasons.unshift("Already in your plan"); }

      return { id: c.id, score, reasons, planned: !!planned?.has(c.id) };
    })
    .sort((a, b) => b.score - a.score);
}

export { AREA_LABEL };
