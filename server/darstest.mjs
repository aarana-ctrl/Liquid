import { parseDars } from "./src/dars.js";
const sample = `BACHELOR OF SCIENCE (COMPUTER SCIENCE)
Catalog Year: AU 25
Earned: 76 credits In-progress: 13 credits Needs: 91 credits
Minimum cumulative GPA... Earned: 3.18 GPA
AU25 ENGL 111 COMPOSITION: LIT 5 4.0
SU24 CSE 122 COMP PROGRAMMING II 4 4.0
SP25 POL S 202 INTRO AMERICAN POL 5 AP
SP26 CSE 311 FOUNDATIONS COMP I 4 IP
SP26 MATH 208 MATRIX ALGEBRA 4 IP
AU25 PHYS 122 ELECTROMAGNETISM 0 NS`;
const s = parseDars(sample);
console.log("program:", s.program, "| catalog:", s.catalogYear, "| gpa:", s.gpa);
console.log("audit:", JSON.stringify(s.audit));
console.log("earned:", s.earned.join(", "));
console.log("inProgress:", s.inProgress.join(", "));
