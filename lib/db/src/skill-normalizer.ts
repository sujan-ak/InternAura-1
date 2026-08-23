/**
 * Skill canonicalisation — fixes gap #11.
 *
 * PLACE AT: lib/db/src/skill-normalizer.ts
 * Then add to lib/db/package.json "exports":
 *     "./skill-normalizer": "./src/skill-normalizer.ts"
 *
 * WHY THIS EXISTS
 * ---------------
 * The old scorer compared skills with `studentSkillSet.has(s.toLowerCase().trim())`
 * — exact whole-string equality. So a resume saying "React.js" scored Missing
 * against an internship wanting "React", "NodeJS" missed "Node.js", and the seed
 * data's own "PowerBI" missed the resume parser's "Power BI".
 *
 * Both the scorer AND the resume parser must import from here so the two halves of
 * the codebase can never drift apart again.
 */

/**
 * Canonical name -> every spelling seen in the wild.
 * Keys are the display form. Values are matched case-insensitively after
 * punctuation stripping, so you do NOT need to list "react.js" AND "React.JS".
 */
const ALIASES: Record<string, string[]> = {
  // --- languages ---
  JavaScript: ["js", "ecmascript", "es6", "es2015", "vanilla js", "javascript es6"],
  TypeScript: ["ts", "type script"],
  Python: ["py", "python3", "python 3"],
  Java: ["java se", "core java", "java8", "java 8"],
  "C++": ["cpp", "c plus plus", "cplusplus"],
  "C#": ["csharp", "c sharp", "dotnet c#"],
  Go: ["golang"],
  Kotlin: [],
  Swift: [],
  R: ["r language", "r lang"],
  SQL: ["structured query language", "ansi sql"],
  HTML: ["html5"],
  CSS: ["css3"],

  // --- frontend ---
  React: ["reactjs", "react.js", "react 18", "react 19"],
  "React Native": ["reactnative", "rn"],
  "Next.js": ["nextjs", "next"],
  "Vue.js": ["vue", "vuejs", "vue 3"],
  Angular: ["angularjs", "angular 2+"],
  Redux: ["redux toolkit", "rtk"],
  Tailwind: ["tailwindcss", "tailwind css"],
  Expo: ["expo go", "expo sdk"],

  // --- backend ---
  "Node.js": ["node", "nodejs", "node js"],
  Express: ["expressjs", "express.js"],
  Django: [],
  Flask: [],
  FastAPI: ["fast api"],
  "REST APIs": ["rest", "rest api", "restful", "restful apis", "restful api"],
  GraphQL: ["graph ql", "graphql api"],

  // --- data ---
  PostgreSQL: ["postgres", "postgre sql", "psql", "postgresql db"],
  MySQL: ["my sql"],
  MongoDB: ["mongo", "mongo db"],
  Redis: [],
  Pandas: ["pandas library"],
  NumPy: ["numpy"],
  Spark: ["apache spark", "pyspark"],
  Airflow: ["apache airflow"],
  "Power BI": ["powerbi", "power-bi", "microsoft power bi"],
  Tableau: [],
  Excel: ["ms excel", "microsoft excel", "advanced excel"],

  // --- ml / ai ---
  PyTorch: ["torch", "py torch"],
  TensorFlow: ["tensor flow", "tf", "tf2"],
  "Scikit-learn": ["sklearn", "scikit learn", "scikitlearn", "sci-kit learn"],
  "Hugging Face": ["huggingface", "hf", "hugging face transformers"],
  Transformers: ["transformer models"],
  LangChain: ["lang chain"],
  OpenCV: ["open cv", "cv2"],
  NLP: ["natural language processing"],
  "Computer Vision": ["cv", "vision"],
  "Machine Learning": ["ml"],
  "Deep Learning": ["dl"],
  "RAG Systems": ["rag", "retrieval augmented generation", "retrieval-augmented generation"],
  "Vector Databases": ["vector db", "vectordb", "pinecone", "weaviate", "qdrant", "chromadb"],

  // --- devops ---
  Docker: ["docker containers", "containerization"],
  Kubernetes: ["k8s", "kube"],
  AWS: ["amazon web services", "aws cloud"],
  GCP: ["google cloud", "google cloud platform"],
  Azure: ["microsoft azure"],
  Git: ["github", "gitlab", "version control", "git version control"],
  "CI/CD": ["cicd", "ci cd", "github actions", "gitlab ci", "jenkins"],

  // --- design ---
  Figma: ["figma design"],
  "Adobe XD": ["xd", "adobe experience design"],
  Illustrator: ["adobe illustrator", "ai illustrator"],
  Photoshop: ["adobe photoshop", "ps"],
  Prototyping: ["prototype", "prototypes", "rapid prototyping", "interactive prototyping"],
  Wireframing: ["wireframe", "wireframes", "wire framing"],
  "Design Systems": ["design system", "component library", "design tokens"],
  "User Research": ["ux research", "user studies", "usability research", "user interviews"],
  "Visual Design": ["visual designer", "ui design", "ui/ux", "ux/ui", "ui ux design"],
  Storybook: ["story book"],

  // --- marketing / analytics ---
  SEO: ["search engine optimization", "search engine optimisation"],
  "Google Analytics": ["ga", "ga4", "google analytics 4"],
  "Google Ads": ["adwords", "google adwords"],
  Copywriting: ["copy writing", "content writing", "content writer"],
  "Social Media": ["social media marketing", "smm", "social media management"],
  "A/B Testing": ["ab testing", "a b testing", "split testing"],
  "Product Analytics": ["product analysis", "mixpanel", "amplitude"],
  Agile: ["scrum", "agile methodology", "agile/scrum"],
  Canva: [],
  Statistics: ["statistical analysis", "stats"],
  Testing: ["unit testing", "jest", "pytest", "vitest", "automated testing"],
};

/** Reverse index built once at module load: normalised alias -> canonical name. */
const LOOKUP: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [canonical, aliases] of Object.entries(ALIASES)) {
    m.set(normalizeKey(canonical), canonical);
    for (const alias of aliases) m.set(normalizeKey(alias), canonical);
  }
  return m;
})();

/**
 * Reduce a skill string to a comparison key.
 * "React.js " -> "reactjs" ; "Node JS" -> "nodejs" ; "C++" -> "c++"
 *
 * `+` and `#` survive so C++ and C# stay distinguishable from C.
 */
function normalizeKey(raw: string): string {
  return String(raw)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9+#]/g, "")
    .trim();
}

/**
 * Map any spelling to its canonical display name.
 * Unknown skills are returned trimmed and unchanged (never dropped) so niche
 * skills still participate in matching — they just match only themselves.
 */
export function canonicalizeSkill(raw: string): string {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  return LOOKUP.get(normalizeKey(trimmed)) ?? trimmed;
}

/** Canonicalise a list, drop blanks, de-duplicate, preserve first-seen order. */
export function canonicalizeSkills(raws: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of raws ?? []) {
    const c = canonicalizeSkill(raw);
    if (!c) continue;
    const k = normalizeKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

/** A Set of comparison keys — what the scorer should hold and test against. */
export function toSkillKeySet(raws: readonly string[]): Set<string> {
  const s = new Set<string>();
  for (const raw of raws ?? []) {
    const k = normalizeKey(canonicalizeSkill(raw));
    if (k) s.add(k);
  }
  return s;
}

/** True when two skill strings refer to the same skill. */
export function isSameSkill(a: string, b: string): boolean {
  if (!a || !b) return false;
  return normalizeKey(canonicalizeSkill(a)) === normalizeKey(canonicalizeSkill(b));
}

/**
 * Word-boundary containment — replaces the naive `.includes()` in the old
 * `interestMatches` loop (gap #12), where interest "AI" matched "email",
 * "available", "training" and "retail".
 */
export function containsTerm(haystack: string, term: string): boolean {
  if (!haystack || !term) return false;
  const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return false;
  // (?<![a-z0-9]) / (?![a-z0-9]) rather than \b so "C++" and "C#" still match.
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i").test(haystack);
}

export const __TEST_ONLY__ = { normalizeKey, LOOKUP };
