import { recommend } from "./src/recommend.js";
import { STUDENT_SNAPSHOT } from "./src/data.js";
const taken = new Set([...STUDENT_SNAPSHOT.earned, ...STUDENT_SNAPSHOT.inProgress]);
console.log("=== Arts & Humanities (need 20 cr, 0 done) — top recs ===");
recommend({ area:"arts", remainingCredits:20, taken, planned:new Set(), satisfied:taken }).slice(0,5)
  .forEach(r => console.log(r.id.padEnd(9), "score",String(r.score).padStart(3), "|", r.reasons.join(" · ")));
console.log("\n=== Now imagine 3 cr left — credit-fit should favor 3cr classes ===");
recommend({ area:"arts", remainingCredits:3, taken, planned:new Set(), satisfied:taken }).slice(0,4)
  .forEach(r => console.log(r.id.padEnd(9), "score",String(r.score).padStart(3), "|", r.reasons.join(" · ")));
console.log("\n=== Social Sciences (need 5 cr left) ===");
recommend({ area:"social", remainingCredits:5, taken, planned:new Set(), satisfied:taken }).slice(0,4)
  .forEach(r => console.log(r.id.padEnd(9), "score",String(r.score).padStart(3), "|", r.reasons.join(" · ")));
