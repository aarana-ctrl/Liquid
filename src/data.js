// ---------------------------------------------------------------------------
// Seed data for the Liquid Course Planner.
//
// In production the catalog + requirements come from each university registrar.
// We model UW so the planner can render required courses, prerequisites,
// requirement buckets (gen-ed areas, electives) and the qualifying-course lists
// a student picks from.
// ---------------------------------------------------------------------------

export const UNIVERSITY = {
  id: "uw",
  name: "University of Washington",
  catalogYear: "2025–2026",
};

// category drives the accent color of a course chip / node
export const CATEGORY_LABELS = {
  intro: "Intro Programming",
  math: "Mathematics",
  core: "CSE Core",
  core400: "Advanced CSE",
  science: "Natural Science",
  arts: "Arts & Humanities",
  social: "Social Sciences",
  english: "English Composition",
};

// ---------------------------------------------------------------------------
// Flat course catalog (what a registrar scrape would populate).
// ---------------------------------------------------------------------------
export const COURSES = {
  // Intro programming
  CSE121: { id: "CSE121", title: "Computer Programming I", credits: 5, category: "intro", prereqs: [] },
  CSE122: { id: "CSE122", title: "Computer Programming II", credits: 5, category: "intro", prereqs: ["CSE121"] },
  CSE123: { id: "CSE123", title: "Computer Programming III", credits: 5, category: "intro", prereqs: ["CSE122"] },

  // Mathematics
  MATH124: { id: "MATH124", title: "Calculus I", credits: 5, category: "math", prereqs: [] },
  MATH125: { id: "MATH125", title: "Calculus II", credits: 5, category: "math", prereqs: ["MATH124"] },
  MATH126: { id: "MATH126", title: "Calculus III", credits: 5, category: "math", prereqs: ["MATH125"] },
  MATH308: { id: "MATH308", title: "Matrix Algebra", credits: 3, category: "math", prereqs: ["MATH126"] },

  // CSE core
  CSE311: { id: "CSE311", title: "Foundations of Computing I", credits: 4, category: "core", prereqs: ["CSE123", "MATH126"] },
  CSE312: { id: "CSE312", title: "Foundations of Computing II", credits: 4, category: "core", prereqs: ["CSE311"] },
  CSE331: { id: "CSE331", title: "Software Design & Implementation", credits: 4, category: "core", prereqs: ["CSE123", "CSE311"] },
  CSE332: { id: "CSE332", title: "Data Structures & Parallelism", credits: 4, category: "core", prereqs: ["CSE123", "CSE311"] },
  CSE351: { id: "CSE351", title: "Hardware/Software Interface", credits: 4, category: "core", prereqs: ["CSE123"] },

  // Advanced CSE (choose-from pool)
  CSE333: { id: "CSE333", title: "Systems Programming", credits: 4, category: "core400", prereqs: ["CSE351", "CSE332"] },
  CSE421: { id: "CSE421", title: "Introduction to Algorithms", credits: 3, category: "core400", prereqs: ["CSE312", "CSE332"] },
  CSE414: { id: "CSE414", title: "Introduction to Database Systems", credits: 4, category: "core400", prereqs: ["CSE332"] },
  CSE415: { id: "CSE415", title: "Introduction to Artificial Intelligence", credits: 3, category: "core400", prereqs: ["CSE332"] },
  CSE403: { id: "CSE403", title: "Software Engineering", credits: 4, category: "core400", prereqs: ["CSE332"] },
  CSE446: { id: "CSE446", title: "Machine Learning", credits: 4, category: "core400", prereqs: ["CSE312", "CSE332"] },
  CSE461: { id: "CSE461", title: "Computer Communication Networks", credits: 4, category: "core400", prereqs: ["CSE332", "CSE351"] },
  CSE451: { id: "CSE451", title: "Operating Systems", credits: 4, category: "core400", prereqs: ["CSE332", "CSE351"] },
  CSE455: { id: "CSE455", title: "Computer Vision", credits: 4, category: "core400", prereqs: ["CSE332"] },

  // English composition
  ENGL131: { id: "ENGL131", title: "Composition: Exposition", credits: 5, category: "english", prereqs: [] },

  // Natural Sciences (qualifying list)
  PHYS121: { id: "PHYS121", title: "Mechanics", credits: 5, category: "science", prereqs: [] },
  PHYS122: { id: "PHYS122", title: "Electromagnetism", credits: 5, category: "science", prereqs: ["PHYS121"] },
  CHEM142: { id: "CHEM142", title: "General Chemistry", credits: 5, category: "science", prereqs: [] },
  BIOL180: { id: "BIOL180", title: "Introductory Biology", credits: 5, category: "science", prereqs: [] },
  ASTR101: { id: "ASTR101", title: "Astronomy", credits: 5, category: "science", prereqs: [] },
  ESS101:  { id: "ESS101",  title: "Introduction to Geology", credits: 5, category: "science", prereqs: [] },
  ATMS111: { id: "ATMS111", title: "Global Warming: Science & Policy", credits: 5, category: "science", prereqs: [] },

  // Arts & Humanities (qualifying list)
  PHIL100: { id: "PHIL100", title: "Introduction to Philosophy", credits: 5, category: "arts", prereqs: [] },
  ARTH201: { id: "ARTH201", title: "Survey of Western Art: Ancient", credits: 5, category: "arts", prereqs: [] },
  MUSIC120:{ id: "MUSIC120", title: "Survey of Music", credits: 5, category: "arts", prereqs: [] },
  DRAMA101:{ id: "DRAMA101", title: "Introduction to the Theatre", credits: 5, category: "arts", prereqs: [] },
  ENGL200: { id: "ENGL200", title: "Reading Literary Forms", credits: 5, category: "arts", prereqs: [] },
  HSTAA101:{ id: "HSTAA101", title: "History of the United States", credits: 5, category: "arts", prereqs: [] },
  CLAS101: { id: "CLAS101", title: "Greek & Roman Classics in English", credits: 5, category: "arts", prereqs: [] },
  PHIL120: { id: "PHIL120", title: "Introduction to Logic", credits: 5, category: "arts", prereqs: [] },

  // Social Sciences (qualifying list)
  PSYCH101:{ id: "PSYCH101", title: "Introduction to Psychology", credits: 5, category: "social", prereqs: [] },
  SOC110:  { id: "SOC110",  title: "Survey of Sociology", credits: 5, category: "social", prereqs: [] },
  POLS101: { id: "POLS101", title: "Introduction to Politics", credits: 5, category: "social", prereqs: [] },
  ECON200: { id: "ECON200", title: "Introduction to Microeconomics", credits: 5, category: "social", prereqs: [] },
  ANTH100: { id: "ANTH100", title: "Introduction to Anthropology", credits: 5, category: "social", prereqs: [] },
  GEOG123: { id: "GEOG123", title: "Introduction to Globalization", credits: 5, category: "social", prereqs: [] },
  COM200:  { id: "COM200",  title: "Introduction to Communication", credits: 5, category: "social", prereqs: [] },
};

// ---------------------------------------------------------------------------
// Majors. Each requirement is one of:
//   kind: "all"     -> every listed course is required
//   kind: "choose"  -> pick `needCount` courses from `courses`
//   kind: "credits" -> earn `needCredits` credits from `courses` (qualifying list)
// ---------------------------------------------------------------------------
export const MAJORS = {
  cs: {
    id: "cs",
    name: "Computer Science (B.S.)",
    school: "Paul G. Allen School of Computer Science & Engineering",
    totalCredits: 180,
    blurb: "Foundations of computing plus depth in systems, theory, and applications, on top of UW's general-education Areas of Inquiry.",
    requirements: [
      { id: "intro", label: "Intro Programming", kind: "all", courses: ["CSE121", "CSE122", "CSE123"] },
      { id: "math", label: "Mathematics", kind: "all", courses: ["MATH124", "MATH125", "MATH126", "MATH308"] },
      { id: "csecore", label: "CSE Core", kind: "all", courses: ["CSE311", "CSE312", "CSE331", "CSE332", "CSE351"] },
      { id: "cse400", label: "Advanced CSE — choose 6", kind: "choose", needCount: 6,
        courses: ["CSE333", "CSE421", "CSE414", "CSE415", "CSE403", "CSE446", "CSE461", "CSE451", "CSE455"] },
      { id: "english", label: "English Composition", kind: "all", courses: ["ENGL131"] },
      { id: "nsc", label: "Natural Sciences — 20 cr", kind: "credits", needCredits: 20,
        courses: ["PHYS121", "PHYS122", "CHEM142", "BIOL180", "ASTR101", "ESS101", "ATMS111"] },
      { id: "ah", label: "Arts & Humanities — 20 cr", kind: "credits", needCredits: 20,
        courses: ["PHIL100", "ARTH201", "MUSIC120", "DRAMA101", "ENGL200", "HSTAA101", "CLAS101", "PHIL120"] },
      { id: "ssc", label: "Social Sciences — 20 cr", kind: "credits", needCredits: 20,
        courses: ["PSYCH101", "SOC110", "POLS101", "ECON200", "ANTH100", "GEOG123", "COM200"] },
    ],
  },
};

// ---------------------------------------------------------------------------
// Mock school-server API (stands in for the authenticated SIS / registrar API).
// Returns the courses a student has already completed.
// ---------------------------------------------------------------------------
export function fetchCompletedCourses({ studentId, majorId }) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const transcripts = {
        cs: ["CSE121", "CSE122", "CSE123", "MATH124", "MATH125", "MATH126", "CSE351", "ENGL131", "PHYS121", "PSYCH101"],
      };
      resolve({
        studentId,
        completed: transcripts[majorId] || [],
        fetchedAt: new Date().toISOString(),
      });
    }, 700);
  });
}

// Parse pasted unofficial-transcript text into known course ids.
// Matches tokens like "CSE 121", "MATH126", "ART H 201", "POL S 101".
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
