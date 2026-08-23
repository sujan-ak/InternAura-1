/**
 * Dynamic Hybrid Recommendation Scorer for InternAura — CORRECTED
 *
 * REPLACES: lib/db/src/hybrid-scorer.ts
 * REQUIRES: lib/db/src/skill-normalizer.ts (new file in this fix pack)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT CHANGED vs. the original, and why
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * #10  semanticMethodUsed used to be hardcoded to "MiniLM Embeddings" whenever
 *      both vectors had equal length — which is ALWAYS true for the local
 *      fallback (both 384 dims). So the UI claimed MiniLM even when the number
 *      came from a character hash, and the "TF-IDF Vector" branch was dead code.
 *      Now the embedder REPORTS which path it took and the scorer passes that
 *      through verbatim. New honest label: "Lexical Hash (fallback)".
 *
 * #11  Skill matching was exact lowercased string equality, so "React.js" vs
 *      "React" scored Missing. Now goes through canonicalizeSkill().
 *
 * #12  Interest matching used unbounded `.includes()`, so interest "AI" matched
 *      "email", "available", "training", "retail". Now uses containsTerm(),
 *      which is word-boundary aware but still matches "C++" and "C#".
 *
 * #14  `Math.max(40, score)` floored every result at 40%, making the bottom half
 *      of the scale unreachable. Removed — the range is now a true 0-100.
 *
 * #16  calculateSkillGapImpact() passed [] for assessments, so its "current
 *      score" disagreed with what /recommendations showed for the same pair.
 *      It now takes and forwards the real assessment records.
 *
 * #21  getEmbedding() no longer burns a 10s AbortController across three URL
 *      attempts (once aborted, attempts 2 and 3 failed instantly). Each attempt
 *      gets its own budget, and a module-level circuit breaker stops hammering a
 *      dead HF endpoint on every single call.
 *
 * Weights are unchanged — they were fine. Only the inputs were wrong.
 */

import {
  canonicalizeSkill,
  toSkillKeySet,
  containsTerm,
} from "./skill-normalizer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StudentProfileInput {
  id?: string;
  name: string;
  degree: string;
  year: string;
  careerGoal: string;
  location: string;
  workMode: string;
  stipendPreference: string;
  interests: string[];
  skills: string[];
}

export interface InternshipInput {
  id: string;
  title: string;
  company: string;
  description: string;
  domain: string;
  location: string;
  workMode: string;
  duration: string;
  stipend: string;
  education?: string | null;
  requiredSkills: string[];
  preferredSkills: string[];
  experienceLevel: string;
  embeddingVector?: number[] | null;
  /** Set for external listings (Adzuna). Surfaced so cards can show Apply. */
  redirectUrl?: string | null;
  source?: "internal" | "adzuna";
}

export interface InteractionInput {
  internshipId: string;
  action: "view" | "save" | "skip" | "apply" | "like";
  reason?: string | null;
}

export interface AssessmentRecordInput {
  skill: string;
  weightedScore: number;
}

/** Honest description of how semanticSimPct was produced. */
export type SemanticMethod =
  | "MiniLM Embeddings"
  | "Lexical Hash (fallback)"
  | "TF-IDF Vector";

export interface AtsBreakdown {
  skillMatchPct: number;
  semanticSimPct: number;
  assessmentPerfPct: number;
  domainEduFitPct: number;
  locationPrefPct: number;
  atsScore: number;
  hasAssessments: boolean;
  semanticMethodUsed: SemanticMethod;
  /** Weight actually applied to each band for THIS result. Sums to 1. */
  weightsApplied: Record<string, number>;
}

export interface ComputedRecommendation {
  studentId: string;
  internshipId: string;
  score: number;
  atsScore: number;
  atsBreakdown: AtsBreakdown;
  reasons: string[];
  skillGap: [string, "Strong" | "Partial" | "Missing"][];
  internship: InternshipInput;
}

export interface EmbeddingResult {
  vector: number[];
  method: SemanticMethod;
}

// ---------------------------------------------------------------------------
// 1. Vector maths
// ---------------------------------------------------------------------------

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function buildTermFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  return tf;
}

export function computeCosineSimilarity(textA: string, textB: string): number {
  const tfA = buildTermFrequency(tokenize(textA));
  const tfB = buildTermFrequency(tokenize(textB));

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const v of tfA.values()) normA += v * v;
  for (const v of tfB.values()) normB += v * v;
  for (const [term, a] of tfA.entries()) {
    const b = tfB.get(term);
    if (b !== undefined) dot += a * b;
  }

  if (normA === 0 || normB === 0) return 0;
  return Math.min(1, Math.max(0, dot / (Math.sqrt(normA) * Math.sqrt(normB))));
}

export function computeVectorCosineSimilarity(
  vecA: number[],
  vecB: number[],
): number {
  if (
    !vecA ||
    !vecB ||
    vecA.length === 0 ||
    vecB.length === 0 ||
    vecA.length !== vecB.length
  ) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return Math.min(1, Math.max(0, dot / (Math.sqrt(normA) * Math.sqrt(normB))));
}

/**
 * Character-hash bag-of-words projection. This is NOT a language model and
 * carries very little semantic signal — it exists only so the pipeline degrades
 * instead of failing when HUGGINGFACE_API_KEY is absent.
 *
 * Callers MUST label results from this path as "Lexical Hash (fallback)".
 */
export function generateLocalDenseEmbedding(
  text: string,
  dimensions = 384,
): number[] {
  const vec = new Array(dimensions).fill(0);
  const words = tokenize(text);
  if (words.length === 0) return vec;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    for (let j = 0; j < word.length; j++) {
      const code = word.charCodeAt(j);
      const h1 = Math.abs((word.length * 31 + code * 17 + i * 13 + j * 7) % dimensions);
      const h2 = Math.abs((code * 37 + j * 19 + i * 29) % dimensions);
      const sign = (code + j) % 2 === 0 ? 1 : -1;
      vec[h1] += sign * (1 / (j + 1));
      vec[h2] += 1 / (i + 1);
    }
  }

  let norm = 0;
  for (let i = 0; i < dimensions; i++) norm += vec[i] * vec[i];
  if (norm > 0) {
    const s = Math.sqrt(norm);
    for (let i = 0; i < dimensions; i++) vec[i] /= s;
  }
  return vec;
}

// ---------------------------------------------------------------------------
// 2. Embeddings, with a circuit breaker
// ---------------------------------------------------------------------------

const HF_URLS = [
  "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2",
  "https://router.huggingface.co/hf-inference/v1/embeddings",
  "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2",
] as const;

const HF_TIMEOUT_MS = Number(process.env.HF_TIMEOUT_MS) || 8000;
const BREAKER_COOLDOWN_MS = 60_000;
const BREAKER_THRESHOLD = 3;

let consecutiveFailures = 0;
let breakerOpenUntil = 0;

function breakerIsOpen(): boolean {
  if (Date.now() < breakerOpenUntil) return true;
  if (breakerOpenUntil !== 0 && Date.now() >= breakerOpenUntil) {
    // Cooldown elapsed — allow one probe.
    breakerOpenUntil = 0;
    consecutiveFailures = 0;
  }
  return false;
}

function recordFailure(): void {
  consecutiveFailures++;
  if (consecutiveFailures >= BREAKER_THRESHOLD) {
    breakerOpenUntil = Date.now() + BREAKER_COOLDOWN_MS;
    console.warn(
      `[ATS Engine] HF inference failed ${consecutiveFailures}x — pausing calls for ${
        BREAKER_COOLDOWN_MS / 1000
      }s and using the lexical fallback.`,
    );
  }
}

function extractVector(data: unknown): number[] | null {
  if (Array.isArray(data) && typeof data[0] === "number") return data as number[];
  if (Array.isArray(data) && Array.isArray(data[0]) && typeof data[0][0] === "number") {
    return data[0] as number[];
  }
  const d = data as { data?: Array<{ embedding?: number[] }> };
  if (Array.isArray(d?.data) && Array.isArray(d.data[0]?.embedding)) {
    return d.data[0].embedding as number[];
  }
  return null;
}

/**
 * Returns BOTH the vector and which method produced it, so callers can label the
 * UI honestly. This is the core fix for gap #10.
 */
export async function getEmbedding(
  text: string,
  apiKey?: string,
): Promise<EmbeddingResult> {
  const key = apiKey || process.env.HUGGINGFACE_API_KEY;

  if (key && !breakerIsOpen()) {
    for (const url of HF_URLS) {
      // FIX #21: a fresh controller per attempt. The original shared one
      // AbortController across all three URLs, so once the 10s timer fired,
      // attempts 2 and 3 aborted instantly without ever being tried.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HF_TIMEOUT_MS);
      try {
        const body = url.endsWith("/v1/embeddings")
          ? { model: "sentence-transformers/all-MiniLM-L6-v2", input: text }
          : { inputs: text };

        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (res.ok) {
          const vec = extractVector(await res.json());
          if (vec && vec.length > 0) {
            consecutiveFailures = 0;
            return { vector: vec, method: "MiniLM Embeddings" };
          }
        }
      } catch {
        // try the next URL
      } finally {
        clearTimeout(timer);
      }
    }
    recordFailure();
  }

  return {
    vector: generateLocalDenseEmbedding(text, 384),
    method: "Lexical Hash (fallback)",
  };
}

/** Back-compat shim for existing callers that only want the vector. */
export async function getHuggingFaceEmbedding(
  text: string,
  apiKey?: string,
): Promise<number[]> {
  return (await getEmbedding(text, apiKey)).vector;
}

// ---------------------------------------------------------------------------
// 3. Scorer
// ---------------------------------------------------------------------------

const WEIGHTS_WITH_ASSESSMENTS = {
  skill: 0.25,
  semantic: 0.25,
  assessment: 0.25,
  domainEdu: 0.15,
  locationPref: 0.1,
} as const;

// Assessment's 25% redistributed proportionally across the remaining bands.
const WEIGHTS_NO_ASSESSMENTS = {
  skill: 0.3333,
  semantic: 0.3333,
  assessment: 0,
  domainEdu: 0.2,
  locationPref: 0.1334,
} as const;

export async function calculateHybridScore(
  student: StudentProfileInput,
  internship: InternshipInput,
  userInteractions: InteractionInput[] = [],
  passedSkills: string[] | Set<string> | AssessmentRecordInput[] = [],
  options?: {
    studentEmbedding?: number[] | null;
    studentEmbeddingMethod?: SemanticMethod;
    internshipEmbedding?: number[] | null;
  },
): Promise<ComputedRecommendation> {
  const studentId = student.id || "00000000-0000-0000-0000-000000000001";

  // FIX #11: comparison keys, not raw lowercased strings.
  const studentSkillKeys = toSkillKeySet(student.skills || []);

  // --- Assessment records ---
  const passedKeys = new Set<string>();
  const assessmentScores: number[] = [];

  if (Array.isArray(passedSkills)) {
    for (const item of passedSkills) {
      if (typeof item === "string") {
        for (const k of toSkillKeySet([item])) passedKeys.add(k);
      } else if (item && typeof item === "object" && "skill" in item) {
        for (const k of toSkillKeySet([item.skill])) passedKeys.add(k);
        if (typeof item.weightedScore === "number" && Number.isFinite(item.weightedScore)) {
          assessmentScores.push(item.weightedScore);
        }
      }
    }
  } else if (passedSkills instanceof Set) {
    for (const s of passedSkills) for (const k of toSkillKeySet([s])) passedKeys.add(k);
  }

  const keyOf = (s: string): string => {
    const [k] = toSkillKeySet([s]);
    return k ?? "";
  };

  const upgrade = (
    base: "Missing" | "Partial" | "Strong",
    skill: string,
  ): "Missing" | "Partial" | "Strong" => {
    if (!passedKeys.has(keyOf(skill))) return base;
    if (base === "Missing") return "Partial";
    return "Strong";
  };

  // --- A. Semantic similarity (25%) ---
  const studentText = [
    student.careerGoal,
    student.degree,
    (student.skills || []).map(canonicalizeSkill).join(" "),
    (student.interests || []).join(" "),
  ].join(" ");

  const internshipText = [
    internship.title,
    internship.domain,
    internship.description,
    (internship.requiredSkills || []).map(canonicalizeSkill).join(" "),
    (internship.preferredSkills || []).map(canonicalizeSkill).join(" "),
  ].join(" ");

  let studentVec: number[] | null | undefined = options?.studentEmbedding;
  let semanticMethodUsed: SemanticMethod =
    options?.studentEmbeddingMethod ?? "Lexical Hash (fallback)";

  if (!studentVec) {
    const r = await getEmbedding(studentText);
    studentVec = r.vector;
    semanticMethodUsed = r.method;
  }

  let internshipVec: number[] | null | undefined =
    options?.internshipEmbedding ?? internship.embeddingVector;

  if (!internshipVec) {
    const r = await getEmbedding(internshipText);
    internshipVec = r.vector;
    // FIX #10: if either side fell back, the RESULT is a fallback. Never claim
    // MiniLM because the dimensions happened to line up.
    if (r.method !== "MiniLM Embeddings") semanticMethodUsed = r.method;
  }

  let semanticSim: number;
  if (studentVec && internshipVec && studentVec.length === internshipVec.length) {
    semanticSim = computeVectorCosineSimilarity(studentVec, internshipVec);
  } else {
    semanticSim = computeCosineSimilarity(studentText, internshipText);
    semanticMethodUsed = "TF-IDF Vector";
  }
  const semanticSimPct = Math.round(semanticSim * 100);

  // --- B. Skill overlap (25%) ---
  const allReq = internship.requiredSkills || [];
  const allPref = internship.preferredSkills || [];

  let matchedReq = 0;
  let matchedPref = 0;
  const skillGap: [string, "Strong" | "Partial" | "Missing"][] = [];
  const processed = new Set<string>();
  const matchedReqNames: string[] = [];

  for (const s of allReq) {
    const k = keyOf(s);
    if (!k || processed.has(k)) continue;
    processed.add(k);

    const base: "Strong" | "Missing" = studentSkillKeys.has(k) ? "Strong" : "Missing";
    const status = upgrade(base, s);

    if (status === "Strong") {
      matchedReq += 1.0;
      matchedReqNames.push(canonicalizeSkill(s));
    } else if (status === "Partial") {
      matchedReq += 0.5;
    }
    skillGap.push([canonicalizeSkill(s), status]);
  }

  for (const s of allPref) {
    const k = keyOf(s);
    if (!k || processed.has(k)) continue;
    processed.add(k);

    // Preferred skills the student lacks are "Partial", not "Missing" — they're
    // nice-to-have, so the gap panel shouldn't scream about them.
    const base: "Strong" | "Partial" = studentSkillKeys.has(k) ? "Strong" : "Partial";
    const status = upgrade(base, s);

    if (status === "Strong") matchedPref += 1.0;
    else if (status === "Partial") matchedPref += 0.5;

    skillGap.push([canonicalizeSkill(s), status]);
  }

  const denom = allReq.length * 1.5 + allPref.length;
  const skillRatio = denom > 0 ? (matchedReq * 1.5 + matchedPref) / denom : 0.5;
  const skillMatchPct = Math.round(Math.min(1, Math.max(0, skillRatio)) * 100);

  // --- C. Assessment performance (25%) ---
  const hasAssessments = assessmentScores.length > 0;
  const assessmentPerfPct = hasAssessments
    ? Math.round(
        Math.min(
          100,
          Math.max(0, assessmentScores.reduce((a, b) => a + b, 0) / assessmentScores.length),
        ),
      )
    : 0;

  // --- D. Domain & education fit (15%) ---
  // FIX #12: word-boundary matching. "AI" no longer matches "email"/"retail".
  const haystack = `${internship.domain} ${internship.title} ${internship.description}`;
  let interestMatches = 0;
  for (const interest of student.interests || []) {
    if (containsTerm(haystack, interest)) interestMatches++;
  }
  const interestRatio =
    (student.interests || []).length > 0 ? Math.min(1, interestMatches / 2) : 0.5;
  const interestPct = interestRatio * 100;

  let eduPct = 70;
  if (internship.education) {
    const edu = internship.education.toLowerCase();
    const deg = (student.degree || "").toLowerCase();
    const FIELDS = [
      ["design", "hci", "visual arts", "graphic"],
      ["cs", "computer science", "b.tech", "b.e.", "it", "software", "engineering"],
      ["data", "statistics", "mathematics", "math", "analytics"],
      ["marketing", "communications", "business", "management", "humanities"],
    ];
    for (const group of FIELDS) {
      const inDegree = group.some((t) => deg.includes(t));
      const inEdu = group.some((t) => edu.includes(t));
      if (inDegree && inEdu) {
        eduPct = 100;
        break;
      }
    }
  }
  const domainEduFitPct = Math.round(interestPct * 0.5 + eduPct * 0.5);

  // --- E. Location, preference & behaviour (10%) ---
  let prefVal = 50;
  const sMode = (student.workMode || "").toLowerCase();
  const iMode = (internship.workMode || "").toLowerCase();
  if (sMode && iMode) {
    if (sMode === iMode) prefVal += 30;
    else if (iMode.includes(sMode) || sMode.includes(iMode)) prefVal += 20;
    else if (iMode.includes("remote")) prefVal += 20;
  }
  if (student.location && internship.location) {
    const sLoc = student.location.toLowerCase();
    const iLoc = internship.location.toLowerCase();
    if (iLoc.includes(sLoc) || sLoc.includes(iLoc) || iLoc.includes("remote")) {
      prefVal += 20;
    }
  }
  prefVal = Math.min(100, prefVal);

  // FIX #3 knock-on: de-duplicate by action so repeatedly tapping the bookmark
  // can no longer inflate a job's score. Each action type counts at most once.
  const distinctActions = new Set(
    userInteractions
      .filter((i) => i.internshipId === internship.id)
      .map((i) => i.action),
  );
  let behaviourVal = 50;
  if (distinctActions.has("apply")) behaviourVal += 25;
  if (distinctActions.has("save") || distinctActions.has("like")) behaviourVal += 15;
  if (distinctActions.has("skip")) behaviourVal -= 40;
  behaviourVal = Math.max(0, Math.min(100, behaviourVal));

  const locationPrefPct = Math.round(prefVal * 0.5 + behaviourVal * 0.5);

  // --- F. Composite ---
  const w = hasAssessments ? WEIGHTS_WITH_ASSESSMENTS : WEIGHTS_NO_ASSESSMENTS;
  const raw =
    skillMatchPct * w.skill +
    semanticSimPct * w.semantic +
    assessmentPerfPct * w.assessment +
    domainEduFitPct * w.domainEdu +
    locationPrefPct * w.locationPref;

  // FIX #14: no artificial floor. A genuinely bad match now reads as a bad match.
  const atsScore = Math.round(Math.min(100, Math.max(0, raw)));

  const atsBreakdown: AtsBreakdown = {
    skillMatchPct,
    semanticSimPct,
    assessmentPerfPct,
    domainEduFitPct,
    locationPrefPct,
    atsScore,
    hasAssessments,
    semanticMethodUsed,
    weightsApplied: { ...w },
  };

  // --- Reasons (only claims we can actually support) ---
  const reasons: string[] = [];
  if (matchedReqNames.length > 0) {
    reasons.push(`Matches required skills: ${matchedReqNames.join(", ")}`);
  }
  // Only claim semantic alignment when a real model produced the number.
  if (semanticMethodUsed === "MiniLM Embeddings" && semanticSim > 0.35) {
    reasons.push(`Strong alignment with your ${student.careerGoal} career goal`);
  }
  if (interestMatches > 0) {
    const hit = (student.interests || []).find((i) => containsTerm(haystack, i));
    if (hit) reasons.push(`Matches your interest in ${hit}`);
  }
  if (sMode && iMode && (sMode === iMode || iMode.includes("remote"))) {
    reasons.push(`${internship.workMode} in ${internship.location} fits your preference`);
  }
  if (hasAssessments && assessmentPerfPct >= 60) {
    reasons.push(`Backed by verified assessment results (${assessmentPerfPct}% avg)`);
  }
  if (reasons.length === 0) {
    reasons.push("Ranked on overall profile fit — see the ATS breakdown for detail");
  }

  return {
    studentId,
    internshipId: internship.id,
    score: atsScore,
    atsScore,
    atsBreakdown,
    reasons,
    skillGap,
    internship,
  };
}

/**
 * "What would learning X do to my score?" — the ONE authoritative implementation.
 *
 * FIX #16: the client had two divergent copies of this (analytics.tsx and
 * internship/[id].tsx, both weighting skill match at ×20 instead of ×0.25) and
 * the original server version dropped assessments, so all three disagreed.
 * Delete the client copies and call this via the API instead.
 *
 * Also note there is no Math.max(1, ...) here — if a skill genuinely changes
 * nothing, this honestly returns 0 rather than inventing "+1%".
 */
export async function calculateSkillGapImpact(
  student: StudentProfileInput,
  internship: InternshipInput,
  hypotheticalSkill: string,
  userInteractions: InteractionInput[] = [],
  assessments: AssessmentRecordInput[] = [],
  options?: {
    studentEmbedding?: number[] | null;
    studentEmbeddingMethod?: SemanticMethod;
    internshipEmbedding?: number[] | null;
  },
): Promise<{
  skill: string;
  currentScore: number;
  projectedScore: number;
  delta: number;
  formattedDelta: string;
}> {
  const current = await calculateHybridScore(
    student,
    internship,
    userInteractions,
    assessments,
    options,
  );

  const canonical = canonicalizeSkill(hypotheticalSkill);
  const hypothetical: StudentProfileInput = {
    ...student,
    skills: [...(student.skills || []), canonical],
  };

  // NOTE: the student embedding is intentionally reused. Adding one skill barely
  // moves the semantic vector, and recomputing would cost an HF round-trip per
  // skill per internship.
  const projected = await calculateHybridScore(
    hypothetical,
    internship,
    userInteractions,
    assessments,
    options,
  );

  const delta = Math.max(0, projected.atsScore - current.atsScore);

  return {
    skill: canonical,
    currentScore: current.atsScore,
    projectedScore: projected.atsScore,
    delta,
    formattedDelta: delta > 0 ? `+${delta}% ATS score if mastered` : "No score change",
  };
}
