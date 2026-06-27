import { recommend, autoSelect, computeRemaining } from "./src/recommend.js";
import { MAJORS, STUDENT_SNAPSHOT } from "./src/data.js";
const major = MAJORS.cs;
const completed = new Set(STUDENT_SNAPSHOT.earned);
const ip = new Set(STUDENT_SNAPSHOT.inProgress);
const chosen = new Set();
const rem = computeRemaining(major, completed, ip, chosen);
console.log("=== Remaining by area ===");
for (const a in rem) console.log(" ", a.padEnd(10), `need ${rem[a].need}`, "remaining", rem[a].remaining);
console.log("\n=== Natural Sciences recs (DIV + W still needed) — breadth should win ===");
recommend({area:"science", remainingMap:rem, taken:new Set([...completed,...ip]), planned:chosen, satisfied:new Set([...completed,...ip])}).slice(0,4)
  .forEach(r=>console.log(" ", r.id.padEnd(9), "covers",r.covers, "| score",String(r.score).padStart(3), "|", r.reasons[0]));
console.log("\n=== Auto-select (AI plan) picks max-coverage courses ===");
const sel = autoSelect(major, completed, ip, chosen);
console.log("  selected:", sel.join(", "));
