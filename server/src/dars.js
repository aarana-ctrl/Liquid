// Parse the text of a UW DARS degree-audit page into a snapshot.
// The bookmarklet sends document.body.innerText from myplan.uw.edu/audit; we
// extract the headline numbers and the completed / in-progress course codes.

export function parseDars(text) {
  const t = String(text || "");

  const program = (t.match(/BACHELOR OF (?:SCIENCE|ARTS) \(([^)]+)\)/i) || [])[1];
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
    program: program ? `Bachelor of Science (${program.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())})` : "Degree",
    catalogYear: catalogYear || "",
    gpa,
    audit,
    earned: [...earned],
    inProgress: [...inProgress],
    terms,
  };
}
