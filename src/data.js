// ---------------------------------------------------------------------------
// Liquid Course Planner — data model + a real MyPlan snapshot.
//
// The STUDENT_SNAPSHOT below was pulled live from UW MyPlan (DARS degree audit
// + course search) through the Claude in Chrome extension while the student was
// logged in. The same shape is what a future connect-and-import run produces.
// ---------------------------------------------------------------------------

export const UNIVERSITY = { id: "uw", name: "University of Washington", catalogYear: "AU 25" };

export const CATEGORY_LABELS = {
  intro: "Intro Programming", math: "Mathematics", core: "CSE Core",
  core400: "Advanced CSE", science: "Natural Science", arts: "Arts & Humanities",
  social: "Social Sciences", english: "English / Writing", diversity: "Diversity",
};

// ---------------------------------------------------------------------------
// Course catalog (codes/titles/credits are real UW courses).
// ---------------------------------------------------------------------------
export const COURSES = {
  // Intro programming
  CSE121: { id: "CSE121", title: "Computer Programming I", credits: 4, category: "intro", prereqs: [] },
  CSE122: { id: "CSE122", title: "Computer Programming II", credits: 4, category: "intro", prereqs: ["CSE121"] },
  CSE123: { id: "CSE123", title: "Computer Programming III", credits: 4, category: "intro", prereqs: ["CSE122"] },

  // Mathematics
  MATH124: { id: "MATH124", title: "Calculus w/ Analytic Geometry I", credits: 5, category: "math", prereqs: [] },
  MATH125: { id: "MATH125", title: "Calculus w/ Analytic Geometry II", credits: 5, category: "math", prereqs: ["MATH124"] },
  MATH126: { id: "MATH126", title: "Calculus w/ Analytic Geometry III", credits: 5, category: "math", prereqs: ["MATH125"] },
  MATH208: { id: "MATH208", title: "Matrix Algebra w/ Applications", credits: 4, category: "math", prereqs: ["MATH126"] },

  // CSE core / fundamentals
  CSE311: { id: "CSE311", title: "Foundations of Computing I", credits: 4, category: "core", prereqs: ["CSE123", "MATH126"] },
  CSE312: { id: "CSE312", title: "Foundations of Computing II", credits: 4, category: "core", prereqs: ["CSE311"] },
  CSE331: { id: "CSE331", title: "Software Design & Implementation", credits: 4, category: "core", prereqs: ["CSE123", "CSE311"] },
  CSE332: { id: "CSE332", title: "Data Structures & Parallelism", credits: 4, category: "core", prereqs: ["CSE123", "CSE311"] },
  CSE351: { id: "CSE351", title: "Hardware/Software Interface", credits: 4, category: "core", prereqs: ["CSE123"] },

  // Advanced CSE (400-level core / electives)
  CSE401: { id: "CSE401", title: "Compiler Construction", credits: 4, category: "core400", prereqs: ["CSE332", "CSE351"] },
  CSE421: { id: "CSE421", title: "Introduction to Algorithms", credits: 4, category: "core400", prereqs: ["CSE312", "CSE332"] },
  CSE451: { id: "CSE451", title: "Operating Systems", credits: 4, category: "core400", prereqs: ["CSE332", "CSE351"] },
  CSE461: { id: "CSE461", title: "Computer Communication Networks", credits: 4, category: "core400", prereqs: ["CSE332", "CSE351"] },
  CSE446: { id: "CSE446", title: "Machine Learning", credits: 4, category: "core400", prereqs: ["CSE312", "CSE332"] },
  CSE455: { id: "CSE455", title: "Computer Vision", credits: 4, category: "core400", prereqs: ["CSE332"] },
  CSE403: { id: "CSE403", title: "Software Engineering", credits: 4, category: "core400", prereqs: ["CSE332"] },
  CSE414: { id: "CSE414", title: "Introduction to Database Systems", credits: 4, category: "core400", prereqs: ["CSE332"] },
  CSE333: { id: "CSE333", title: "Systems Programming", credits: 4, category: "core400", prereqs: ["CSE351", "CSE332"] },

  // Natural Sciences
  CHEM142: { id: "CHEM142", title: "General Chemistry", credits: 5, category: "science", prereqs: [] },
  CHEM152: { id: "CHEM152", title: "General Chemistry", credits: 5, category: "science", prereqs: ["CHEM142"] },
  PHYS121: { id: "PHYS121", title: "Mechanics", credits: 5, category: "science", prereqs: [] },
  STAT290: { id: "STAT290", title: "AP Statistics", credits: 5, category: "science", prereqs: [] },

  // English / Writing
  ENGL111: { id: "ENGL111", title: "Composition: Literature", credits: 5, category: "english", prereqs: [] },
  ESS101:  { id: "ESS101",  title: "Geology & Society (W)", credits: 5, category: "science", prereqs: [] },
  CSE391:  { id: "CSE391",  title: "System & Software Tools", credits: 1, category: "core400", prereqs: [] },

  // Social Sciences (real qualifying courses + the student's completed ones)
  ECON200: { id: "ECON200", title: "Introduction to Microeconomics", credits: 5, category: "social", prereqs: [] },
  HSTAA101:{ id: "HSTAA101", title: "Survey of History of the US", credits: 5, category: "social", prereqs: [] },
  POLS202: { id: "POLS202", title: "Introduction to American Politics", credits: 5, category: "social", prereqs: [] },
  PSYCH101:{ id: "PSYCH101", title: "Introduction to Psychology", credits: 5, category: "social", prereqs: [] },
  SOC110:  { id: "SOC110",  title: "Survey of Sociology", credits: 5, category: "social", prereqs: [] },
  ANTH100: { id: "ANTH100", title: "Introduction to Anthropology", credits: 5, category: "social", prereqs: [] },
  GEOG123: { id: "GEOG123", title: "Introduction to Globalization", credits: 5, category: "social", prereqs: [] },

  // Arts & Humanities (real courses pulled from MyPlan course search, A&H filter)
  AIS170:  { id: "AIS170",  title: "American Indian Art & Aesthetics", credits: 5, category: "arts", prereqs: [] },
  CHID120: { id: "CHID120", title: "Yoga: Past and Present", credits: 5, category: "arts", prereqs: [] },
  CMS297:  { id: "CMS297",  title: "Cinema & Media Studies", credits: 5, category: "arts", prereqs: [] },
  COM200:  { id: "COM200",  title: "Introduction to Communication", credits: 5, category: "arts", prereqs: [] },
  PHIL100: { id: "PHIL100", title: "Introduction to Philosophy", credits: 5, category: "arts", prereqs: [] },
  DRAMA101:{ id: "DRAMA101", title: "Introduction to the Theatre", credits: 5, category: "arts", prereqs: [] },
  MUSIC120:{ id: "MUSIC120", title: "Survey of Music", credits: 5, category: "arts", prereqs: [] },
  ENGL200: { id: "ENGL200", title: "Reading Literary Forms", credits: 5, category: "arts", prereqs: [] },

  // Diversity
  AES150:  { id: "AES150",  title: "Intro to American Ethnic Studies (DIV)", credits: 5, category: "diversity", prereqs: [] },
  GWSS200: { id: "GWSS200", title: "Intro to Gender, Women & Sexuality (DIV)", credits: 5, category: "diversity", prereqs: [] },
};

// ---------------------------------------------------------------------------
// Major requirements, mirroring the real DARS audit structure for UW CS.
//   kind: "all"     -> every listed course required
//   kind: "choose"  -> pick needCount courses from `courses`
//   kind: "credits" -> earn needCredits from the qualifying `courses` list
//   kind: "info"    -> already-satisfied / advising note (display only)
// ---------------------------------------------------------------------------
export const MAJORS = {
  cs: {
    id: "cs",
    name: "Computer Science (B.S.)",
    school: "Paul G. Allen School of Computer Science & Engineering",
    totalCredits: 180,
    blurb: "Bachelor of Science in Computer Science, College of Arts & Sciences. Catalog AU 25.",
    requirements: [
      { id: "engl", label: "English Composition", kind: "info", met: true, note: "Satisfied by ENGL 111." },
      { id: "writing", label: "Writing (W) — 10 cr", kind: "credits", needCredits: 10, courses: ["ESS101"] },
      { id: "diversity", label: "Diversity — 5 cr", kind: "credits", needCredits: 5, courses: ["AES150", "GWSS200"] },
      { id: "ah", label: "Arts & Humanities — 20 cr", kind: "credits", needCredits: 20,
        courses: ["AIS170", "CHID120", "CMS297", "COM200", "PHIL100", "DRAMA101", "MUSIC120", "ENGL200"] },
      { id: "ssc", label: "Social Sciences — 20 cr", kind: "credits", needCredits: 20,
        courses: ["ECON200", "HSTAA101", "POLS202", "PSYCH101", "SOC110", "ANTH100", "GEOG123"] },
      { id: "nsc", label: "Natural Sciences — 20 cr", kind: "credits", needCredits: 20,
        courses: ["CHEM142", "CHEM152", "PHYS121", "STAT290"] },
      { id: "math", label: "Mathematics", kind: "all", courses: ["MATH124", "MATH125", "MATH126", "MATH208"] },
      { id: "fund", label: "CSE Fundamentals", kind: "all", courses: ["CSE123", "CSE311", "CSE312", "CSE331", "CSE332", "CSE351"] },
      { id: "core400", label: "Advanced CSE — Core & Electives (choose 7)", kind: "choose", needCount: 7,
        courses: ["CSE401", "CSE421", "CSE451", "CSE461", "CSE446", "CSE455", "CSE403", "CSE414", "CSE333"] },
    ],
  },
};

// ---------------------------------------------------------------------------
// Live MyPlan snapshot for the signed-in student (pulled from DARS).
//   earned     = completed courses (count toward degree)
//   inProgress = currently registered (IP in DARS)
//   audit      = headline numbers straight from the audit
// ---------------------------------------------------------------------------
// Embedded fallback (used when the page is opened directly from disk, where
// fetch() of a local file is blocked). On a real host, fetchMyPlanSnapshot
// pulls public/student-snapshot.json fresh on every call.
export const STUDENT_SNAPSHOT = {
  source: "UW MyPlan · DARS audit",
  fetchedAt: "2026-06-26T08:31:59Z",
  preparedFor: "aarana",
  program: "Bachelor of Science (Computer Science)",
  catalogYear: "AU 25",
  gpa: 3.18,
  audit: { totalRequired: 180, earned: 76, inProgress: 13, needs: 91 },
  earned: ["ENGL111", "CSE121", "CSE122", "CSE123", "MATH124", "MATH125", "MATH126",
           "CHEM142", "CHEM152", "PHYS121", "STAT290", "ECON200", "HSTAA101", "POLS202",
           "CSE331", "CSE351", "CSE391"],
  inProgress: ["CSE311", "MATH208", "ESS101"],
};

// Pulls the latest snapshot fresh every call (cache-busted). The snapshot file
// is refreshed by a connect-and-read run through the browser session/agent, so
// each Connect reflects the most recent live read. Falls back to the embedded
// copy when fetch isn't available (e.g. opened via file://).
export async function fetchMyPlanSnapshot() {
  try {
    const res = await fetch(`./student-snapshot.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return { ...STUDENT_SNAPSHOT, fetchedAt: STUDENT_SNAPSHOT.fetchedAt, _fallback: true };
  }
}

// Parse pasted unofficial-transcript / DARS text into known course ids.
export function parseTranscript(text) {
  const found = new Set();
  const re = /([A-Z][A-Z&]*(?:\s[A-Z&]+)?)\s*([0-9]{3})/g;
  let m;
  while ((m = re.exec(text.toUpperCase())) !== null) {
    const id = (m[1] + m[2]).replace(/\s+/g, "");
    if (COURSES[id]) found.add(id);
  }
  return [...found];
}
