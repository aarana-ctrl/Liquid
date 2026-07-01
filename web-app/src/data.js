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
  // Triple-overlay course: Natural Science credits + Diversity + Writing at once.
  ENVIR239:{ id: "ENVIR239", title: "Sustainability: Personal Choices, Broad Impacts", credits: 5, category: "science", prereqs: [], gened: ["science", "diversity", "writing"], csRelevant: false },
  BIOL106: { id: "BIOL106", title: "Plants & Society", credits: 5, category: "science", prereqs: [], gened: ["science", "diversity"] },

  // English / Writing
  ENGL111: { id: "ENGL111", title: "Composition: Literature", credits: 5, category: "english", prereqs: [] },
  ESS101:  { id: "ESS101",  title: "Geology & Society", credits: 5, category: "science", prereqs: [], gened: ["science", "writing"] },
  CSE391:  { id: "CSE391",  title: "System & Software Tools", credits: 1, category: "core400", prereqs: [] },

  // Social Sciences (gened: which areas a course can satisfy; csRelevant: degree fit)
  ECON200: { id: "ECON200", title: "Introduction to Microeconomics", credits: 5, category: "social", prereqs: [], gened: ["social"], csRelevant: true, relevanceNote: "Quantitative modeling — pairs well with CS" },
  HSTAA101:{ id: "HSTAA101", title: "Survey of History of the US", credits: 5, category: "social", prereqs: [], gened: ["social"] },
  POLS202: { id: "POLS202", title: "Introduction to American Politics", credits: 5, category: "social", prereqs: [], gened: ["social"] },
  POLS101: { id: "POLS101", title: "Introduction to Politics", credits: 5, category: "social", prereqs: [], gened: ["social"] },
  PSYCH101:{ id: "PSYCH101", title: "Introduction to Psychology", credits: 5, category: "social", prereqs: [], gened: ["social"], csRelevant: true, relevanceNote: "Foundation for human-computer interaction" },
  SOC110:  { id: "SOC110",  title: "Survey of Sociology", credits: 5, category: "social", prereqs: [], gened: ["social"] },
  ANTH100: { id: "ANTH100", title: "Introduction to Anthropology", credits: 5, category: "social", prereqs: [], gened: ["social", "diversity"] },
  GEOG123: { id: "GEOG123", title: "Introduction to Globalization", credits: 5, category: "social", prereqs: [], gened: ["social", "diversity"] },
  INFO200: { id: "INFO200", title: "Intellectual Foundations of Informatics", credits: 5, category: "social", prereqs: [], gened: ["social"], csRelevant: true, relevanceNote: "Information & society — directly CS-adjacent" },

  // Arts & Humanities (real courses + gen-ed codes pulled from MyPlan A&H search)
  AIS170:  { id: "AIS170",  title: "American Indian Art & Aesthetics", credits: 5, category: "arts", prereqs: [], gened: ["arts", "diversity"] },
  CHID120: { id: "CHID120", title: "Yoga: Past and Present", credits: 5, category: "arts", prereqs: [], gened: ["arts", "social", "diversity"] },
  CMS297:  { id: "CMS297",  title: "Cinema & Media Studies", credits: 5, category: "arts", prereqs: [], gened: ["arts"], csRelevant: true, relevanceNote: "Media + computation crossover" },
  COM200:  { id: "COM200",  title: "Introduction to Communication", credits: 5, category: "arts", prereqs: [], gened: ["arts", "social"], csRelevant: true, relevanceNote: "Communication skills for tech roles" },
  PHIL100: { id: "PHIL100", title: "Introduction to Philosophy", credits: 5, category: "arts", prereqs: [], gened: ["arts"] },
  PHIL120: { id: "PHIL120", title: "Introduction to Logic", credits: 5, category: "arts", prereqs: [], gened: ["arts"], csRelevant: true, relevanceNote: "Formal logic — basis of CSE 311" },
  PHIL338: { id: "PHIL338", title: "Ethics in the Information Age", credits: 5, category: "arts", prereqs: [], gened: ["arts"], csRelevant: true, relevanceNote: "Tech ethics — directly CS-relevant" },
  DRAMA101:{ id: "DRAMA101", title: "Introduction to the Theatre", credits: 5, category: "arts", prereqs: [], gened: ["arts"] },
  MUSIC120:{ id: "MUSIC120", title: "Survey of Music", credits: 5, category: "arts", prereqs: [], gened: ["arts"] },
  MUSIC131:{ id: "MUSIC131", title: "History of Jazz", credits: 3, category: "arts", prereqs: [], gened: ["arts"] },
  DRAMA210:{ id: "DRAMA210", title: "Theatre History", credits: 3, category: "arts", prereqs: [], gened: ["arts"] },
  ENGL200: { id: "ENGL200", title: "Reading Literary Forms", credits: 5, category: "arts", prereqs: [], gened: ["arts"] },
  ARTH201: { id: "ARTH201", title: "Survey of Western Art", credits: 5, category: "arts", prereqs: [], gened: ["arts"] },

  // Diversity
  AES150:  { id: "AES150",  title: "Intro to American Ethnic Studies", credits: 5, category: "diversity", prereqs: [], gened: ["diversity", "social"] },
  GWSS200: { id: "GWSS200", title: "Intro to Gender, Women & Sexuality", credits: 5, category: "diversity", prereqs: [], gened: ["diversity", "social"] },
  CHID101: { id: "CHID101", title: "The Idea of Diversity", credits: 5, category: "diversity", prereqs: [], gened: ["diversity", "arts"] },

  // Informatics + Math-minor courses
  INFO201: { id: "INFO201", title: "Technical Foundations of Informatics", credits: 5, category: "core", prereqs: ["INFO200"] },
  INFO300: { id: "INFO300", title: "Research Methods", credits: 5, category: "core", prereqs: ["INFO201"] },
  INFO340: { id: "INFO340", title: "Client-Side Development", credits: 5, category: "core400", prereqs: ["INFO201"] },
  INFO360: { id: "INFO360", title: "Design Methods", credits: 4, category: "core400", prereqs: ["INFO201"] },
  MATH307: { id: "MATH307", title: "Introduction to Differential Equations", credits: 3, category: "math", prereqs: ["MATH126"] },
  MATH324: { id: "MATH324", title: "Advanced Multivariable Calculus", credits: 3, category: "math", prereqs: ["MATH126"] },
};

// Tag natural-science courses with a gened area for the recommender.
for (const id of ["CHEM142", "CHEM152", "PHYS121", "STAT290"]) if (COURSES[id]) COURSES[id].gened = ["science"];

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
      { id: "writing", label: "Writing (W) — 10 cr", kind: "credits", area: "writing", needCredits: 10, courses: ["ESS101"] },
      { id: "diversity", label: "Diversity — 5 cr", kind: "credits", area: "diversity", needCredits: 5, courses: ["AES150", "GWSS200", "CHID101"] },
      { id: "ah", label: "Arts & Humanities — 20 cr", kind: "credits", area: "arts", needCredits: 20,
        courses: ["AIS170", "CHID120", "CMS297", "COM200", "PHIL100", "PHIL120", "PHIL338", "DRAMA101", "MUSIC120", "MUSIC131", "DRAMA210", "ENGL200", "ARTH201"] },
      { id: "ssc", label: "Social Sciences — 20 cr", kind: "credits", area: "social", needCredits: 20,
        courses: ["ECON200", "HSTAA101", "POLS202", "POLS101", "PSYCH101", "SOC110", "ANTH100", "GEOG123", "INFO200"] },
      { id: "nsc", label: "Natural Sciences — 20 cr", kind: "credits", area: "science", needCredits: 20,
        courses: ["CHEM142", "CHEM152", "PHYS121", "STAT290"] },
      { id: "math", label: "Mathematics", kind: "all", courses: ["MATH124", "MATH125", "MATH126", "MATH208"] },
      { id: "fund", label: "CSE Fundamentals", kind: "all", courses: ["CSE123", "CSE311", "CSE312", "CSE331", "CSE332", "CSE351"] },
      { id: "core400", label: "Advanced CSE — Core & Electives (choose 7)", kind: "choose", area: "core400", needCount: 7,
        courses: ["CSE401", "CSE421", "CSE451", "CSE461", "CSE446", "CSE455", "CSE403", "CSE414", "CSE333"] },
    ],
  },

  informatics: {
    id: "informatics",
    name: "Informatics (B.S.)",
    school: "The Information School",
    totalCredits: 180,
    blurb: "Bachelor of Science in Informatics — information, people, and technology.",
    requirements: [
      { id: "engl", label: "English Composition", kind: "info", met: true, note: "Satisfied by ENGL 111." },
      { id: "writing", label: "Writing (W) — 10 cr", kind: "credits", area: "writing", needCredits: 10, courses: ["ESS101"] },
      { id: "diversity", label: "Diversity — 5 cr", kind: "credits", area: "diversity", needCredits: 5, courses: ["AES150", "GWSS200", "CHID101"] },
      { id: "ah", label: "Arts & Humanities — 20 cr", kind: "credits", area: "arts", needCredits: 20,
        courses: ["AIS170", "CHID120", "CMS297", "COM200", "PHIL100", "PHIL120", "PHIL338", "DRAMA101", "MUSIC120", "MUSIC131", "DRAMA210", "ENGL200", "ARTH201"] },
      { id: "ssc", label: "Social Sciences — 20 cr", kind: "credits", area: "social", needCredits: 20,
        courses: ["ECON200", "HSTAA101", "POLS202", "POLS101", "PSYCH101", "SOC110", "ANTH100", "GEOG123", "INFO200"] },
      { id: "nsc", label: "Natural Sciences — 20 cr", kind: "credits", area: "science", needCredits: 20,
        courses: ["CHEM142", "CHEM152", "PHYS121", "STAT290"] },
      { id: "math", label: "Mathematics", kind: "all", courses: ["MATH124", "MATH126"] },
      { id: "infocore", label: "Informatics Core", kind: "all", courses: ["INFO200", "INFO201", "INFO300"] },
      { id: "core400", label: "Informatics Electives (choose 4)", kind: "choose", area: "core400", needCount: 4,
        courses: ["CSE414", "CSE446", "CSE455", "CSE403", "INFO340", "INFO360"] },
    ],
  },
};

// ---------------------------------------------------------------------------
// Minors. Each delta adjusts the active program's requirements:
//   { area, addCredits }  -> add credits to the matching credit requirement
//   { area, addCount }    -> add courses to the matching "choose" requirement
//   { kind:"all", ... }   -> append a new required-courses block
// ---------------------------------------------------------------------------
export const MINORS = {
  sustainability: {
    id: "sustainability", name: "Sustainability Minor",
    deltas: [ { area: "science", addCredits: 5 }, { area: "arts", addCredits: 5 } ],
  },
  datascience: {
    id: "datascience", name: "Data Science Minor",
    deltas: [ { area: "core400", addCount: 2 }, { area: "social", addCredits: 5 } ],
  },
  math: {
    id: "math", name: "Mathematics Minor",
    deltas: [ { kind: "all", id: "min-math", label: "Minor: Mathematics", courses: ["MATH307", "MATH324"] } ],
  },
  // Broader UW minor list (department requirements resolve from DARS on import).
  amath: { id: "amath", name: "Applied Mathematics Minor" },
  stats: { id: "stats", name: "Statistics Minor", deltas: [ { area: "science", addCredits: 5 } ] },
  astrobio: { id: "astrobio", name: "Astrobiology Minor" },
  econ: { id: "econ", name: "Economics Minor", deltas: [ { area: "social", addCredits: 10 } ] },
  psych: { id: "psych", name: "Psychology Minor", deltas: [ { area: "social", addCredits: 10 } ] },
  philosophy: { id: "philosophy", name: "Philosophy Minor", deltas: [ { area: "arts", addCredits: 10 } ] },
  english: { id: "english", name: "English Minor", deltas: [ { area: "arts", addCredits: 10 } ] },
  history: { id: "history", name: "History Minor", deltas: [ { area: "arts", addCredits: 10 } ] },
  music: { id: "music", name: "Music Minor", deltas: [ { area: "arts", addCredits: 5 } ] },
  physics: { id: "physics", name: "Physics Minor", deltas: [ { area: "science", addCredits: 10 } ] },
  chem: { id: "chem", name: "Chemistry Minor", deltas: [ { area: "science", addCredits: 10 } ] },
  biology: { id: "biology", name: "Biology Minor", deltas: [ { area: "science", addCredits: 10 } ] },
  geog: { id: "geog", name: "Geography Minor", deltas: [ { area: "social", addCredits: 5 } ] },
  pols: { id: "pols", name: "Political Science Minor", deltas: [ { area: "social", addCredits: 10 } ] },
  comm: { id: "comm", name: "Communication Minor", deltas: [ { area: "arts", addCredits: 5 } ] },
  hcde: { id: "hcde", name: "Human Centered Design & Eng. Minor" },
  entre: { id: "entre", name: "Entrepreneurship Minor" },
  diversity: { id: "diversity", name: "Diversity Minor", deltas: [ { area: "diversity", addCredits: 10 } ] },
  global: { id: "global", name: "Global Health Minor" },
  spanish: { id: "spanish", name: "Spanish Minor", deltas: [ { area: "arts", addCredits: 5 } ] },
};
// Bulk minors (requirements resolve from DARS). Added to MINORS by name.
`American Sign Language|Arabic|Architecture|Art History|Astronomy|Bioethics & Humanities|
Chinese|Cinema & Media Studies|Comparative Literature|Creative Writing|Dance|Data Science|
Design|European Studies|French|Gender, Women & Sexuality Studies|German|Human Rights|
Informatics|Italian|Japanese|Jewish Studies|Korean|Labor Studies|Latin American Studies|
Law, Societies & Justice|Linguistics|Microbiology|Near Eastern Languages|Nutritional Sciences|
Oceanography|Public Health|Quantitative Science|Russian|Scandinavian|Sociology|Sustainability|
Urban Design & Planning`
  .split("|").map((s) => s.trim()).filter(Boolean).forEach((name) => {
    const id = "m_" + name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 18);
    if (!MINORS[id] && !Object.values(MINORS).some((m) => m.name === name + " Minor")) MINORS[id] = { id, name: name + " Minor" };
  });

// ---------------------------------------------------------------------------
// Full program catalog for the picker. Majors with detailed requirements live
// in MAJORS above; the rest resolve to a general template (Areas of Inquiry +
// a department-major bucket whose exact courses come from the student's DARS).
// ---------------------------------------------------------------------------
// Bulk UW undergraduate majors. cs + informatics have detailed requirements
// (in MAJORS); the rest resolve to the general template.
const _MAJORS_RAW = `
Aeronautics & Astronautics (B.S.)|Engineering
American Ethnic Studies (B.A.)|Arts & Sciences
Anthropology (B.A.)|Arts & Sciences
Applied & Computational Math Sciences (B.S.)|Arts & Sciences
Aquatic & Fishery Sciences (B.S.)|Environment
Architecture (B.A.)|Built Environments
Art History (B.A.)|Arts & Sciences
Art: Interdisciplinary Visual Arts (B.A.)|Arts & Sciences
Astronomy (B.S.)|Arts & Sciences
Atmospheric Sciences (B.S.)|Environment
Bioengineering (B.S.)|Engineering
Biochemistry (B.S.)|Arts & Sciences
Biology (B.S.)|Arts & Sciences
Business Administration (B.A.)|Foster School
Chemical Engineering (B.S.)|Engineering
Chemistry (B.S.)|Arts & Sciences
Chinese (B.A.)|Arts & Sciences
Cinema & Media Studies (B.A.)|Arts & Sciences
Civil Engineering (B.S.)|Engineering
Classics (B.A.)|Arts & Sciences
Communication (B.A.)|Arts & Sciences
Community, Environment & Planning (B.A.)|Built Environments
Comparative History of Ideas (B.A.)|Arts & Sciences
Comparative Literature (B.A.)|Arts & Sciences
Computer Engineering (B.S.)|Allen School of CSE
Construction Management (B.S.)|Built Environments
Dance (B.A.)|Arts & Sciences
Data Science (B.S.)|Interdisciplinary
Design: Visual Communication (B.Des.)|Arts & Sciences
Drama (B.A.)|Arts & Sciences
Early Childhood & Family Studies (B.A.)|Education
Earth & Space Sciences (B.S.)|Environment
Ecology, Evolution & Conservation (B.S.)|Arts & Sciences
Economics (B.A.)|Arts & Sciences
Electrical & Computer Engineering (B.S.)|Engineering
English (B.A.)|Arts & Sciences
Environmental Health (B.S.)|Public Health
Environmental Science & Resource Mgmt (B.S.)|Environment
Environmental Studies (B.A.)|Environment
Finance (B.A.)|Foster School
French (B.A.)|Arts & Sciences
Gender, Women & Sexuality Studies (B.A.)|Arts & Sciences
Geography (B.A.)|Arts & Sciences
Geography: Data Science (B.A.)|Arts & Sciences
Germanics (B.A.)|Arts & Sciences
History (B.A.)|Arts & Sciences
Human Centered Design & Engineering (B.S.)|Engineering
Industrial & Systems Engineering (B.S.)|Engineering
International Studies (B.A.)|Jackson School
Italian Studies (B.A.)|Arts & Sciences
Japanese (B.A.)|Arts & Sciences
Journalism & Public Interest Comm. (B.A.)|Arts & Sciences
Korean (B.A.)|Arts & Sciences
Landscape Architecture (B.L.A.)|Built Environments
Law, Societies & Justice (B.A.)|Arts & Sciences
Linguistics (B.A.)|Arts & Sciences
Marine Biology (B.S.)|Environment
Materials Science & Engineering (B.S.)|Engineering
Mathematics (B.S.)|Arts & Sciences
Mechanical Engineering (B.S.)|Engineering
Microbiology (B.S.)|Medicine
Music (B.A.)|Arts & Sciences
Near Eastern Languages & Civilization (B.A.)|Arts & Sciences
Neuroscience (B.S.)|Arts & Sciences
Nursing (B.S.N.)|Nursing
Nutritional Sciences (B.S.)|Public Health
Oceanography (B.S.)|Environment
Philosophy (B.A.)|Arts & Sciences
Physics (B.S.)|Arts & Sciences
Political Science (B.A.)|Arts & Sciences
Psychology (B.S.)|Arts & Sciences
Public Health-Global Health (B.A.)|Public Health
Real Estate (B.A.)|Foster School
Religion: Comparative Religion (B.A.)|Arts & Sciences
Russian (B.A.)|Arts & Sciences
Scandinavian Studies (B.A.)|Arts & Sciences
Social Welfare (B.A.)|Social Work
Sociology (B.A.)|Arts & Sciences
Spanish (B.A.)|Arts & Sciences
Speech & Hearing Sciences (B.S.)|Arts & Sciences
Statistics (B.S.)|Arts & Sciences
Urban Design & Planning (B.A.)|Built Environments
`;
const _slug = (name) => name.toLowerCase().replace(/\(b[^)]*\)/, "").replace(/[^a-z0-9]+/g, "").slice(0, 22);
export const MAJOR_CATALOG = [
  { id: "cs", name: "Computer Science (B.S.)", school: "Allen School of CSE" },
  { id: "informatics", name: "Informatics (B.S.)", school: "The Information School" },
  ..._MAJORS_RAW.trim().split("\n").map((line) => { const [name, school] = line.split("|"); return { id: _slug(name), name: name.trim(), school: (school || "UW").trim() }; }),
];

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
  // the quarter each course was taken (UW codes: AU/WI/SP/SU + 2-digit year)
  terms: {
    CSE122: "SU24",
    ENGL111: "AU25", CSE123: "AU25", MATH125: "AU25",
    MATH126: "WI26", CSE331: "WI26", CSE351: "WI26", CSE391: "WI26",
    CSE311: "SP26", MATH208: "SP26", ESS101: "SP26",
    CSE121: "PRE", MATH124: "PRE", CHEM142: "PRE", CHEM152: "PRE", PHYS121: "PRE",
    STAT290: "PRE", ECON200: "PRE", HSTAA101: "PRE", POLS202: "PRE",
  },
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

// Shared gen-ed pools, reused by the generic-major template.
const AH_POOL = ["AIS170", "CHID120", "CMS297", "COM200", "PHIL100", "PHIL120", "PHIL338", "DRAMA101", "MUSIC120", "MUSIC131", "DRAMA210", "ENGL200", "ARTH201"];
const SSC_POOL = ["ECON200", "HSTAA101", "POLS202", "POLS101", "PSYCH101", "SOC110", "ANTH100", "GEOG123", "INFO200"];
const NSC_POOL = ["CHEM142", "CHEM152", "PHYS121", "STAT290", "ENVIR239", "BIOL106", "ESS101"];

// A general degree template for majors without hand-authored requirements.
export function genericProgram(entry) {
  return {
    id: entry.id, name: entry.name, school: entry.school, totalCredits: 180,
    requirements: [
      { id: "engl", label: "English Composition", kind: "info", note: "One English composition course (5 cr)." },
      { id: "writing", label: "Writing (W) — 10 cr", kind: "credits", area: "writing", needCredits: 10, courses: ["ESS101", "ENVIR239"] },
      { id: "diversity", label: "Diversity — 5 cr", kind: "credits", area: "diversity", needCredits: 5, courses: ["AES150", "GWSS200", "CHID101"] },
      { id: "ah", label: "Arts & Humanities — 20 cr", kind: "credits", area: "arts", needCredits: 20, courses: AH_POOL },
      { id: "ssc", label: "Social Sciences — 20 cr", kind: "credits", area: "social", needCredits: 20, courses: SSC_POOL },
      { id: "nsc", label: "Natural Sciences — 20 cr", kind: "credits", area: "science", needCredits: 20, courses: NSC_POOL },
      { id: "major", label: `${entry.name.replace(/\s*\(B\.[A-Z.]+\)/, "")} — major courses`, kind: "info", note: "Department-specific requirements load from your DARS audit when you sync." },
    ],
  };
}
export function resolveProgram(majorId) {
  if (MAJORS[majorId]) return MAJORS[majorId];
  const entry = MAJOR_CATALOG.find((m) => m.id === majorId);
  return entry ? genericProgram(entry) : MAJORS.cs;
}

// Merge selected minors into a major's requirements to form the active program.
function relabel(r) {
  if (r.kind === "credits") r.label = r.label.replace(/\d+ cr/, `${r.needCredits} cr`);
  if (r.kind === "choose") r.label = r.label.replace(/choose \d+/i, `choose ${r.needCount}`);
}
export function buildProgram(major, minorIds = []) {
  const reqs = major.requirements.map((r) => ({ ...r, courses: r.courses ? [...r.courses] : r.courses }));
  const minors = minorIds.map((id) => MINORS[id]).filter(Boolean);
  for (const min of minors) {
    if (!min.deltas || !min.deltas.length) {
      reqs.push({ id: `min-${min.id}`, label: `Minor: ${min.name.replace(" Minor", "")}`, kind: "info", note: "Minor requirements resolve from your DARS audit." });
      continue;
    }
    for (const d of min.deltas || []) {
      if (d.kind === "all") {
        reqs.push({ id: d.id, label: d.label, kind: "all", courses: [...d.courses], fromMinor: min.id });
      } else if (d.addCredits != null) {
        const r = reqs.find((r) => r.area === d.area && r.kind === "credits");
        if (r) { r.needCredits += d.addCredits; r.fromMinor = (r.fromMinor || []).concat(min.id); relabel(r); }
      } else if (d.addCount != null) {
        const r = reqs.find((r) => r.area === d.area && r.kind === "choose");
        if (r) { r.needCount += d.addCount; r.fromMinor = (r.fromMinor || []).concat(min.id); relabel(r); }
      }
    }
  }
  const minorLabel = minors.length ? " + " + minors.map((m) => m.name.replace(" Minor", "")).join(" & ") + " minor" : "";
  return { ...major, requirements: reqs, minorIds: minors.map((m) => m.id), name: major.name + minorLabel };
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
