import { MAJORS, MINORS, buildProgram } from "./src/data.js";
// replicate quarter helpers
const TERM_ORDER={WI:0,SP:1,SU:2,AU:3}, ORDER_TERM=["WI","SP","SU","AU"], TERM_NAME={AU:"Autumn",WI:"Winter",SP:"Spring",SU:"Summer"};
const qAbs=(t,y)=>y*4+TERM_ORDER[t]; const absToQ=a=>({term:ORDER_TERM[((a%4)+4)%4],year:Math.floor(a/4)});
const lbl=a=>{const q=absToQ(a);return `${TERM_NAME[q.term]} ${q.year}`};
const parseQ=c=>{const m=/^([A-Z]{2})(\d{2})$/.exec(c);return qAbs(m[1],2000+ +m[2])};
console.log("=== quarter labels (real DARS terms) ===");
["SU24","AU25","SP25","WI26","SP26"].forEach(c=>console.log(" ",c,"->",lbl(parseQ(c))));
const cur=qAbs("SP",2026);
console.log("current (June 2026) =", lbl(cur), "| chronological order check:", parseQ("SU24")<parseQ("AU25"), parseQ("AU25")<parseQ("WI26"), parseQ("WI26")<parseQ("SP26"));
console.log("\n=== Auto Plan future quarters (skip summer) from next quarter ===");
function nextQ(start,n,inc){const o=[];let a=start;while(o.length<n){if(inc||absToQ(a).term!=="SU")o.push(a);a++}return o}
console.log(" ", nextQ(cur+1,6,false).map(lbl).join(" | "));
console.log("\n=== Minor merge ===");
const base=MAJORS.cs.requirements.find(r=>r.area==="science");
console.log(" CS base Natural Sciences:", base.needCredits, "cr");
const p1=buildProgram(MAJORS.cs,["sustainability"]);
console.log(" + Sustainability minor:", p1.requirements.find(r=>r.area==="science").label, "/", p1.requirements.find(r=>r.area==="arts").label);
console.log(" program name:", p1.name);
const p2=buildProgram(MAJORS.cs,["datascience"]);
console.log(" + Data Science minor:", p2.requirements.find(r=>r.area==="core400").label, "/", p2.requirements.find(r=>r.area==="social").label);
const p3=buildProgram(MAJORS.informatics,[]);
console.log(" switch major -> Informatics core:", p3.requirements.find(r=>r.id==="infocore").courses.join(","));
