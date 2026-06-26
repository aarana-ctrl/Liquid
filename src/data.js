// ---------------------------------------------------------------------------
// Seed data for the Liquid Course Planner.
//
// In production this is replaced by a university catalog API. Each university +
// degree exposes its minimum requirements; we model them here for UW CS so the
// planner can render the required courses, prerequisites, and pathways.
//
// category: "intro" | "math" | "core" | "core400" | "science" | "gened"
// prereqs:  array of course ids that must be completed first
// year:     recommended year (1-4) — used by the semester grid view
// ---------------------------------------------------------------------------

export const UNIVERSITY = {
  id: "uw",
  name: "University of Washington",
  catalogYear: "2025–2026",
};

// The course catalog, keyed by major id.
export const MAJORS = {
  cs: {
    id: "cs",
    name: "Computer Science (B.S.)",
    school: "Paul G. Allen School of Computer Science & Engineering",
    totalCredits: 180,
    blurb:
      "Foundations of computing plus depth in systems, theory, and applications. " +
      "Requires the intro programming sequence, calculus, the CSE core, and " +
      "additional 300/400-level CSE coursework.",
    courses: [
      // Intro programming sequence
      { id: "CSE121", title: "Computer Programming I", credits: 5, category: "intro", prereqs: [], year: 1 },
      { id: "CSE122", title: "Computer Programming II", credits: 5, category: "intro", prereqs: ["CSE121"], year: 1 },
      { id: "CSE123", title: "Computer Programming III", credits: 5, category: "intro", prereqs: ["CSE122"], year: 1 },

      // Mathematics
      { id: "MATH124", title: "Calculus I", credits: 5, category: "math", prereqs: [], year: 1 },
      { id: "MATH125", title: "Calculus II", credits: 5, category: "math", prereqs: ["MATH124"], year: 1 },
      { id: "MATH126", title: "Calculus III", credits: 5, category: "math", prereqs: ["MATH125"], year: 2 },
      { id: "MATH308", title: "Matrix Algebra", credits: 3, category: "math", prereqs: ["MATH126"], year: 2 },

      // CSE core (fundamentals)
      { id: "CSE311", title: "Foundations of Computing I", credits: 4, category: "core", prereqs: ["CSE123", "MATH126"], year: 2 },
      { id: "CSE312", title: "Foundations of Computing II", credits: 4, category: "core", prereqs: ["CSE311"], year: 3 },
      { id: "CSE331", title: "Software Design & Implementation", credits: 4, category: "core", prereqs: ["CSE123", "CSE311"], year: 3 },
      { id: "CSE332", title: "Data Structures & Parallelism", credits: 4, category: "core", prereqs: ["CSE123", "CSE311"], year: 3 },
      { id: "CSE351", title: "Hardware/Software Interface", credits: 4, category: "core", prereqs: ["CSE123"], year: 2 },

      // Advanced CSE (400-level core / electives)
      { id: "CSE333", title: "Systems Programming", credits: 4, category: "core400", prereqs: ["CSE351", "CSE332"], year: 3 },
      { id: "CSE421", title: "Introduction to Algorithms", credits: 3, category: "core400", prereqs: ["CSE312", "CSE332"], year: 4 },
      { id: "CSE414", title: "Introduction to Database Systems", credits: 4, category: "core400", prereqs: ["CSE332"], year: 4 },
      { id: "CSE415", title: "Introduction to Artificial Intelligence", credits: 3, category: "core400", prereqs: ["CSE332"], year: 4 },
      { id: "CSE403", title: "Software Engineering", credits: 4, category: "core400", prereqs: ["CSE332"], year: 4 },
      { id: "CSE461", title: "Computer Communication Networks", credits: 4, category: "core400", prereqs: ["CSE332", "CSE351"], year: 4 },

      // Science
      { id: "PHYS121", title: "Mechanics", credits: 5, category: "science", prereqs: ["MATH124"], year: 1 },
      { id: "PHYS122", title: "Electromagnetism & Oscillatory Motion", credits: 5, category: "science", prereqs: ["PHYS121", "MATH125"], year: 2 },

      // General education
      { id: "ENGL131", title: "Composition: Exposition", credits: 5, category: "gened", prereqs: [], year: 1 },
      { id: "GENED1", title: "Arts & Humanities Elective", credits: 5, category: "gened", prereqs: [], year: 1 },
      { id: "GENED2", title: "Social Sciences Elective", credits: 5, category: "gened", prereqs: [], year: 2 },
    ],
  },

  // Lighter stubs to show the picker is multi-major / extensible.
  informatics: {
    id: "informatics",
    name: "Informatics (B.S.)",
    school: "The Information School",
    totalCredits: 180,
    blurb: "Demo stub — full requirements pulled from the catalog API in production.",
    courses: [
      { id: "INFO200", title: "Intellectual Foundations of Informatics", credits: 5, category: "core", prereqs: [], year: 1 },
      { id: "INFO201", title: "Technical Foundations", credits: 5, category: "core", prereqs: ["INFO200"], year: 2 },
      { id: "INFO300", title: "Research Methods", credits: 5, category: "core", prereqs: ["INFO201"], year: 3 },
      { id: "MATH124", title: "Calculus I", credits: 5, category: "math", prereqs: [], year: 1 },
      { id: "ENGL131", title: "Composition: Exposition", credits: 5, category: "gened", prereqs: [], year: 1 },
    ],
  },

  datascience: {
    id: "datascience",
    name: "Data Science (B.S.)",
    school: "Interdisciplinary",
    totalCredits: 180,
    blurb: "Demo stub — full requirements pulled from the catalog API in production.",
    courses: [
      { id: "CSE121", title: "Computer Programming I", credits: 5, category: "intro", prereqs: [], year: 1 },
      { id: "STAT311", title: "Elements of Statistical Methods", credits: 5, category: "math", prereqs: [], year: 2 },
      { id: "MATH124", title: "Calculus I", credits: 5, category: "math", prereqs: [], year: 1 },
      { id: "MATH308", title: "Matrix Algebra", credits: 3, category: "math", prereqs: ["MATH124"], year: 2 },
      { id: "CSE414", title: "Introduction to Database Systems", credits: 4, category: "core400", prereqs: ["CSE121"], year: 3 },
    ],
  },
};

export const CATEGORY_LABELS = {
  intro: "Intro Programming",
  math: "Mathematics",
  core: "CSE Core",
  core400: "Advanced CSE",
  science: "Natural Science",
  gened: "General Education",
};

// ---------------------------------------------------------------------------
// Mock school-server API.
//
// In production this is an authenticated call to the university SIS (student
// information system) after the student signs in with their school ID. It
// returns the courses the student has already completed (transcript data).
// Here we simulate the network round-trip + a sample transcript.
// ---------------------------------------------------------------------------
export function fetchCompletedCourses({ studentId, majorId }) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const transcripts = {
        cs: ["CSE121", "CSE122", "CSE123", "MATH124", "MATH125", "MATH126", "CSE351", "ENGL131", "PHYS121"],
        informatics: ["INFO200", "MATH124"],
        datascience: ["CSE121", "MATH124"],
      };
      resolve({
        studentId,
        completed: transcripts[majorId] || [],
        fetchedAt: new Date().toISOString(),
      });
    }, 900); // simulated latency
  });
}
