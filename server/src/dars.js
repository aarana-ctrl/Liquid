// Parse the text of a UW DARS degree-audit page into a snapshot.
// The bookmarklet sends document.body.innerText from myplan.uw.edu/audit; we
// extract the headline numbers and the completed / in-progress course codes.

export function parseDars(text) {
  const t = String(text || "");

  // Program title — bachelor's major, or a minor audit ("MINOR (STATISTICS)").
  const bach = t.match(/BACHELOR OF (?:SCIENCE|ARTS) \(([^)]+)\)/i);
  const minorM = !bach && t.match(/\bMINOR(?:\s+IN)?\s*\(?\s*([A-Z][A-Za-z &]+?)\s*\)?\s*(?:\n|Catalog)/i);
  const program = bach ? bach[1] : null;
  const minorName = minorM ? minorM[1].trim() : null;
  const cased = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const programTitle = bach ? `Bachelor of Science (${cased(program)})`
    : minorName ? `Minor (${cased(minorName)})` : "Degree";
  const catalogYear = (t.match(/Catalog Year:\s*([A-Z]{2}\s*\d{2})/i) || [])[1]?.replace(/\s+/g, " ").trim();
  const gpa = parseFloat((t.match(/Earned:\s*([\d.]+)\s*GPA/i) || [])[1]) || null;

  const credits = t.match(/Earned:\s*(\d+)\s*credits\s*In-progress:\s*(\d+)\s*credits\s*Needs:\s*(\d+)\s*credits/i);
  const audit = credits
    ? { totalRequired: 180, earned: +credits[1], inProgress: +credits[2], needs: +credits[3] }
    : { totalRequired: 180, earned: 0, inProgress: 0, needs: 180 };

  // Course rows: "AU25 CSE 311 FOUNDATIONS COMP I 4 IP" / "SP25 POL S 202 ... 5 AP"
  // Capture the quarter code (e.g. SP25) so the planner can place each course
  // in the quarter it was actually taken.
  const earned = new Set(), inProgress = new Set(), terms = {};
  const re = /\b([A-Z]{2}\d{2})\s+([A-Z][A-Z&]*(?:\s[A-Z&]+)?)\s+(\d{3})\b([^\n]*)/g;
  let m;
  while ((m = re.exec(t)) !== null) {
    const qtr = m[1];                            // e.g. "SP25"
    const id = (m[2] + m[3]).replace(/\s+/g, "");
    const rest = m[4] || "";
    if (/\bNS\b/.test(rest) && /\b0\b/.test(rest)) continue; // doesn't count for credit
    if (/\bIP\b/.test(rest)) inProgress.add(id); else earned.add(id);
    // AP / transfer credits aren't tied to a real quarter -> "PRE" (pre-matriculation)
    if (!terms[id]) terms[id] = /\b(AP|TRANSFER|RUNNING|CIHS)\b/.test(rest) ? "PRE" : qtr;
  }
  for (const id of inProgress) earned.delete(id);

  return {
    source: "UW MyPlan · DARS (imported)",
    fetchedAt: new Date().toISOString(),
    program: programTitle,
    level: bach ? "major" : minorName ? "minor" : "degree",
    catalogYear: catalogYear || "",
    gpa,
    audit,
    earned: [...earned],
    inProgress: [...inProgress],
    terms,
    requirements: parseRequirements(t),   // full per-requirement breakdown
  };
}

// Extract every requirement block DARS lists, with its exact earned / in-progress
// / needed credits (or courses). This is what powers exact, per-category compare.
export function parseRequirements(text) {
  const lines = String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const STATUS = /^(NO|OK|IP[+-]?|N\/A|Completed|Not completed|In progress|THE SUB-REQUIREMENT|A COURSE IS|IP\+|IP-|Qtr\b|Notes$|NOTE:|FEDERAL LAW|END OF ANALYSIS|Related:|Show incomplete|Choose Different|Refresh Audit|Date Prepared|Prepared For|Graduation Date|Catalog Year|This report|Please review|Audit a UW|For more information|For reference|For Reference)/i;
  const COURSE_ROW = /^[A-Z]{2}\d{2}\s+[A-Z]/;                 // e.g. "AU25 CSE 311 ..."
  const CREDIT = /(Earned:|In-progress:|Needs:)/;
  const num = (re, s) => { const mm = s.match(re); return mm ? +mm[1] : null; };

  const CODE = /\b([A-Z]{1,4})\s?(\d{3})\b/g;                  // candidate course codes, e.g. "CSE 123"
  const COURSELIST = /^(select from|choose from|from the following|the following courses|courses:)/i;
  // A line that is basically just a list of course codes (not a requirement sentence).
  const isMostlyCodes = (line) => {
    const codes = line.match(/\b[A-Z]{1,4}\s?\d{3}\b/g) || [];
    if (codes.length < 2) return false;
    const rest = line.replace(/\b[A-Z]{1,4}\s?\d{3}\b/g, "").replace(/[,;&/]|\bor\b|\band\b|\s/gi, "");
    return rest.length <= 4;
  };

  const reqs = [];
  let label = null, cur = null, curLines = [];
  const flush = () => {
    if (cur && (cur.needsCr != null || cur.needsCourses != null || cur.earnedCr != null)) {
      const codes = [];
      for (const ln of curLines) { let m; CODE.lastIndex = 0; while ((m = CODE.exec(ln)) !== null) { const id = m[1] + m[2]; if (!/^(AU|WI|SP|SU)\d/.test(m[1] + m[2]) && !codes.includes(id)) codes.push(id); } }
      cur.selectCourses = codes.slice(0, 16); // courses that can satisfy this requirement
      reqs.push(cur);
    }
    cur = null; curLines = [];
  };
  for (const line of lines) {
    if (CREDIT.test(line)) {
      if (!cur) cur = { label: label || "Requirement", earnedCr: null, ipCr: null, needsCr: null, needsCourses: null };
      const e = num(/Earned:\s*(\d+)\s*credits/i, line); if (e != null) cur.earnedCr = e;
      const ip = num(/In-progress:\s*(\d+)\s*credits/i, line); if (ip != null) cur.ipCr = ip;
      const nc = num(/Needs:\s*(\d+)\s*credits/i, line); if (nc != null) cur.needsCr = nc;
      const no = num(/Needs:\s*(\d+)\s*course/i, line); if (no != null) cur.needsCourses = no;
      curLines.push(line); continue;
    }
    if (STATUS.test(line) || COURSE_ROW.test(line) || /^[\d.]+$/.test(line)) { curLines.push(line); continue; }
    if (/[A-Za-z]/.test(line) && line.length > 3) {
      // A "select from / one of X, Y" course list belongs to the CURRENT requirement,
      // not a new one — keep it in the block so we can list the courses.
      if (cur && (COURSELIST.test(line) || isMostlyCodes(line))) {
        curLines.push(line); continue;
      }
      flush(); label = line.replace(/\s+/g, " ").trim(); cur = null; curLines = [line];
    }
  }
  flush();
  const byLabel = {};
  for (const r of reqs) {
    const k = r.label.toLowerCase();
    if (!byLabel[k] || (r.needsCr ?? r.needsCourses ?? 0) > (byLabel[k].needsCr ?? byLabel[k].needsCourses ?? 0)) byLabel[k] = r;
  }
  return Object.values(byLabel);
}
