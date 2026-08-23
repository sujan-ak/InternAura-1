/**
 * Assessment routes — CORRECTED
 * REPLACES: artifacts/api-server/src/routes/assessment.ts
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FIX #1 — AI GENERATION NEVER WORKED, NOT ONCE
 * ─────────────────────────────────────────────────────────────────────────────
 * The old code at line 369-370 was:
 *
 *     const startIdx = rawText.find("{");     // Python method
 *     const endIdx   = rawText.rfind("}");    // Python method
 *
 * `String.prototype.find` does not exist in JavaScript. This threw
 * `TypeError: rawText.find is not a function` on EVERY call — including when
 * Groq returned a perfectly valid response — and the surrounding try/catch
 * silently swallowed it and returned getFallbackQuestions().
 *
 * Confirmed in the repo's own committed server.log, lines 644 and 716:
 *     [Assessment Generate Warning] Groq call failed or timed out
 *     (rawText.find is not a function). Using fallback questions.
 *
 * So every assessment for every skill was the same 10 hardcoded generic
 * questions — a Figma test showed designers a Python `def process_items` snippet
 * — while the UI said "Generating 10 questions via AI…".
 *
 * `tsc` could not catch this because `rawText` came off a `data: any`.
 * Fixed here with indexOf/lastIndexOf AND a typed parse helper.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FIX #2 — SCORES WERE TRIVIALLY FORGEABLE
 * ─────────────────────────────────────────────────────────────────────────────
 * (a) /generate returned correct_answer + explanation to the client BEFORE the
 *     student answered. The answer key was in the network tab.
 * (b) /evaluate graded against the `questions` array the CLIENT posted back, on
 *     an unauthenticated endpoint, with student_id from the body. One curl wrote
 *     a "Highly Proficient" row for any student — feeding 25% of the ATS score.
 * (c) Grading used `cleanC.includes(cleanU)` with a 4-char floor, so typing
 *     "use " scored a full 10/10 on a question worth 40% weight.
 *
 * Now: questions go out WITHOUT answers, the key stays server-side keyed by
 * sessionId, identity comes from the verified JWT, and grading is exact-match
 * against the stored key.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FIX #19 — retakes appended rows, and /recommendations averaged every attempt
 * scoring >= 60. Grinding retakes ratcheted your ATS score up permanently.
 * Now UPSERTs on (student_id, skill), keeping the BEST score.
 * Requires the unique index in patches/sql/001_fix_schema.sql.
 *
 * API SHAPE CHANGE (client must be updated together with this file):
 *   OLD  POST /assessment/generate {skill}      -> {questions:[{...,correct_answer}]}
 *        POST /assessment/evaluate {skill, questions, student_answers, student_id}
 *   NEW  POST /assessment/sessions {skill}      -> {sessionId, questions:[{...}]}
 *        POST /assessment/sessions/:id/submit {answers}
 */

import { Router, type Request, type Response, type IRouter } from "express";
import { db, assessmentsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth";
import { asyncHandler, HttpError } from "../middlewares/error-handler";
import {
  createSession,
  claimSession,
  saveSessionResult,
  toPublicQuestions,
  type StoredQuestion,
} from "../lib/assessment-store";
import { logger } from "../lib/logger";
import { env } from "../lib/env";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuestionEvaluation {
  question_id: string;
  prompt: string;
  question_type: string;
  difficulty: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  score: number;
  max_score: number;
  explanation: string;
  score_0_to_5?: number | null;
  demonstrated_concepts?: string[] | null;
  missing_concepts?: string[] | null;
  feedback?: string | null;
}

export interface CategoryScore {
  category: string;
  score: number;
  max_score: number;
  percentage: number;
  weight: number;
}

const CATEGORY_WEIGHTS = {
  mcq: 0.2,
  conceptual: 0.2,
  debugging: 0.2,
  practical: 0.4,
} as const;

const CATEGORY_LABELS: Record<string, string> = {
  mcq: "Fundamentals (MCQ)",
  conceptual: "Conceptual & Reasoning",
  debugging: "Debugging & Problem Solving",
  practical: "Practical & Coding",
};

// ---------------------------------------------------------------------------
// Fallback question bank (used only when GROQ_API_KEY is absent or Groq fails)
// ---------------------------------------------------------------------------

export function getFallbackQuestions(skill: string): StoredQuestion[] {
  return [
    {
      id: "q1",
      type: "mcq",
      prompt: `Which best describes the core design paradigm of ${skill} in modern software engineering?`,
      options: [
        "Imperative execution without encapsulation",
        "Modular, reusable, and predictable component architecture",
        "Monolithic procedural execution only",
        "Database schema definition framework",
      ],
      correct_answer: "Modular, reusable, and predictable component architecture",
      explanation: `${skill} emphasises modularity, predictability, and maintainability across application layers.`,
      difficulty: "beginner",
    },
    {
      id: "q2",
      type: "mcq",
      prompt: `In ${skill}, what is the primary benefit of enforcing strict contracts or state immutability?`,
      options: [
        "Reduces error rate by catching bugs before runtime",
        "Slows down execution speed significantly",
        "Forces all functions to run synchronously",
        "Eliminates the need for automated unit tests",
      ],
      correct_answer: "Reduces error rate by catching bugs before runtime",
      explanation: "Strict contracts let tooling catch mismatches and mutations before runtime.",
      difficulty: "beginner",
    },
    {
      id: "q3",
      type: "mcq",
      prompt: `When handling asynchronous work in ${skill}, which pattern avoids blocking the main thread?`,
      options: [
        "Busy-waiting while loop",
        "Non-blocking async/await or promise-based flow",
        "Synchronous thread sleep",
        "Global variable mutation polling",
      ],
      correct_answer: "Non-blocking async/await or promise-based flow",
      explanation: "Async patterns keep execution responsive instead of freezing the caller.",
      difficulty: "beginner",
    },
    {
      id: "q4",
      type: "mcq",
      prompt: `What is the recommended approach for sharing state across modules in ${skill}?`,
      options: [
        "Mutating arbitrary global variables",
        "A single source of truth via centralised state or dependency injection",
        "Writing state to local files on every call",
        "Hardcoding config in every file",
      ],
      correct_answer: "A single source of truth via centralised state or dependency injection",
      explanation: "Centralised state avoids hidden mutations and race conditions.",
      difficulty: "intermediate",
    },
    {
      id: "q5",
      type: "mcq",
      prompt: `Which error-handling strategy best supports resilience in ${skill} systems?`,
      options: [
        "Swallowing all exceptions with empty catch blocks",
        "Crashing immediately without logging",
        "Structured handling with explicit logging and contextual fallbacks",
        "Disabling error logging in production",
      ],
      correct_answer: "Structured handling with explicit logging and contextual fallbacks",
      explanation: "Explicit propagation lets systems fail gracefully and stay debuggable.",
      difficulty: "intermediate",
    },
    {
      id: "q6",
      type: "conceptual",
      prompt: `Explain how caching or memoisation improves performance in ${skill}, and what trade-offs it introduces.`,
      options: null,
      correct_answer:
        "Caching stores computed results keyed by their inputs so repeated work is skipped. Trade-offs: stale data when the source changes, memory growth, and cache-invalidation complexity.",
      explanation: "Look for both the mechanism and at least one concrete trade-off.",
      difficulty: "intermediate",
    },
    {
      id: "q7",
      type: "conceptual",
      prompt: `Why does memory-leak prevention matter in long-running ${skill} services, and how do unreleased references cause failures?`,
      options: null,
      correct_answer:
        "Unreleased references keep objects reachable, so the garbage collector cannot free them. Over hours or days the heap grows until the process is OOM-killed or GC pauses degrade latency.",
      explanation: "Look for reachability preventing collection, plus a runtime consequence.",
      difficulty: "advanced",
    },
    {
      id: "q8",
      type: "debugging",
      prompt: `Identify the bug in this snippet and choose the correct fix:`,
      code_snippet: "def process_items(items=[]):\n    items.append('new_item')\n    return items",
      options: [
        "Use 'items=None' and initialise inside the function when None",
        "Change 'items.append' to 'items.add'",
        "Remove the return statement",
        "Replace 'def' with 'async def'",
      ],
      correct_answer: "Use 'items=None' and initialise inside the function when None",
      explanation: "Default mutable arguments are evaluated once and shared across every call.",
      difficulty: "intermediate",
    },
    {
      id: "q9",
      type: "debugging",
      prompt: `This snippet leaks a file descriptor. Which fix guarantees release?`,
      code_snippet: "f = open('data.json', 'r')\ndata = json.load(f)\nreturn data",
      options: [
        "Use a context manager: 'with open(...) as f:'",
        "Add 'f.flush()' before returning",
        "Convert the file to binary format",
        "Wrap json.load in a loop",
      ],
      correct_answer: "Use a context manager: 'with open(...) as f:'",
      explanation: "Context managers release the descriptor even when an exception is raised.",
      difficulty: "advanced",
    },
    {
      id: "q10",
      type: "practical",
      prompt: `Choose the best production implementation for a fetch with retry resiliency in ${skill}:`,
      starter_code: "// Task: implement exponential-backoff retry",
      options: [
        "Retry up to N times with exponential backoff and a maximum timeout",
        "Infinite while loop retrying every millisecond",
        "Single attempt with no error handling",
        "Return hardcoded fallback data without attempting the request",
      ],
      correct_answer: "Retry up to N times with exponential backoff and a maximum timeout",
      explanation: "Backoff avoids thundering herds while tolerating transient faults.",
      difficulty: "advanced",
    },
  ];
}

// ---------------------------------------------------------------------------
// Groq helpers
// ---------------------------------------------------------------------------

/**
 * FIX #1: this is the function that replaces `rawText.find("{")`.
 * indexOf/lastIndexOf are the real JS methods, and the return type is `unknown`
 * so callers are forced to validate rather than trusting `any`.
 */
function parseJsonFromLlm(raw: string): unknown {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new HttpError(502, "Empty response from AI service");
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const candidate = start !== -1 && end !== -1 && end > start ? raw.slice(start, end + 1) : raw;
  try {
    return JSON.parse(candidate);
  } catch {
    throw new HttpError(502, "AI service returned malformed JSON");
  }
}

const GeneratedQuestions = z.object({
  questions: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        prompt: z.string().min(1),
        options: z.array(z.string()).nullable().optional(),
        code_snippet: z.string().nullable().optional(),
        starter_code: z.string().nullable().optional(),
        correct_answer: z.string().min(1),
        explanation: z.string().default(""),
        difficulty: z.string().default("intermediate"),
      }),
    )
    .min(5),
});

async function callGroq(prompt: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // NOTE: the old code used model "groq/compound", which server.log shows
        // returning HTTP 413 and 429. Model is now configurable via GROQ_MODEL.
        model: env.GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Groq HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data?.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

async function generateQuestions(skill: string, level: string): Promise<{
  questions: StoredQuestion[];
  source: "ai" | "fallback";
  fallbackReason?: string;
}> {
  if (!env.GROQ_API_KEY) {
    return { questions: getFallbackQuestions(skill), source: "fallback", fallbackReason: "AI question generation is not configured" };
  }

  const prompt = `You are a senior technical interviewer creating a competency assessment for internship candidates.
Generate exactly 10 questions for the skill '${skill}' at ${level} level.

Structure: 5 mcq, 2 conceptual, 2 debugging, 1 practical.
Difficulty spread: 3 beginner, 4 intermediate, 3 advanced.

Rules:
- Questions must test real competency and edge cases, not rote recall.
- For 'mcq', 'debugging' and 'practical': provide exactly 4 entries in 'options' and set 'correct_answer' to the exact text of the right option.
- For 'conceptual': set 'options' to null and put a model answer in 'correct_answer' describing the concepts a strong response must cover.
- For 'debugging': put the buggy code in 'code_snippet'. For 'practical': put starter code in 'starter_code'.
- Use ids 'q1' through 'q10'.

Return ONLY this JSON:
{"questions":[{"id":"q1","type":"mcq","prompt":"...","options":["A","B","C","D"],"code_snippet":null,"starter_code":null,"correct_answer":"B","explanation":"...","difficulty":"beginner"}]}`;

  try {
    const raw = await callGroq(prompt, 20_000);
    const parsed = GeneratedQuestions.parse(parseJsonFromLlm(raw));
    return {
      questions: parsed.questions.map((q) => ({
        ...q,
        options: q.options ?? null,
        code_snippet: q.code_snippet ?? null,
        starter_code: q.starter_code ?? null,
      })),
      source: "ai",
    };
  } catch (err) {
    // Log LOUDLY. The old code logged a warning that nobody read for weeks.
    logger.error({ err, skill }, "AI question generation failed — serving fallback bank");
    return {
      questions: getFallbackQuestions(skill),
      source: "fallback",
      fallbackReason: "AI generation unavailable — showing our standard question bank",
    };
  }
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

/**
 * FIX #2c: the old code accepted any answer that was a >=4-char substring of the
 * correct answer, so "use " scored 10/10. Objective question types are now exact
 * match against the stored option text (whitespace/case normalised only).
 */
function normalizeChoice(s: string): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function gradeObjective(userAnswer: string, correctAnswer: string): { correct: boolean; score: number } {
  const correct =
    normalizeChoice(userAnswer).length > 0 &&
    normalizeChoice(userAnswer) === normalizeChoice(correctAnswer);
  return { correct, score: correct ? 10 : 0 };
}

const ConceptualGrade = z.object({
  score_0_to_5: z.number().min(0).max(5),
  demonstrated_concepts: z.array(z.string()).default([]),
  missing_concepts: z.array(z.string()).default([]),
  feedback: z.string().default(""),
});

/**
 * Heuristic grader for free-text answers when Groq is unavailable.
 *
 * The old version rewarded length: >40 chars plus 15% token overlap scored 4.5/5,
 * so padding an answer with words lifted from the question scored well. This
 * version ignores tokens that appear in the PROMPT (which the student can see)
 * and only credits concepts from the answer key they could not have copied.
 */
function gradeConceptualHeuristic(
  skill: string,
  prompt: string,
  userAnswer: string,
  correctAnswer: string,
): z.infer<typeof ConceptualGrade> {
  const answer = String(userAnswer ?? "").trim();
  if (answer.length < 15) {
    return {
      score_0_to_5: 0,
      demonstrated_concepts: [],
      missing_concepts: ["A substantive technical explanation"],
      feedback: "Too short to assess. Explain the mechanism and at least one trade-off.",
    };
  }

  const stop = new Set([
    "that", "this", "with", "from", "have", "which", "when", "what", "your", "will",
    "they", "there", "their", "than", "then", "into", "some", "more", "them", "does",
  ]);
  const promptTokens = new Set(prompt.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const keyTokens = [
    ...new Set(correctAnswer.toLowerCase().split(/\W+/).filter((w) => w.length > 3)),
  ].filter((w) => !stop.has(w) && !promptTokens.has(w));

  const answerLower = answer.toLowerCase();
  const hits = keyTokens.filter((t) => answerLower.includes(t));
  const coverage = keyTokens.length > 0 ? hits.length / keyTokens.length : 0;

  // Coverage drives the score; length alone cannot.
  let score = 0;
  if (coverage >= 0.5) score = 4.5;
  else if (coverage >= 0.3) score = 3.5;
  else if (coverage >= 0.15) score = 2.5;
  else if (coverage > 0) score = 1.5;
  else score = 0.5;

  return {
    score_0_to_5: score,
    demonstrated_concepts: hits.slice(0, 5),
    missing_concepts: keyTokens.filter((t) => !answerLower.includes(t)).slice(0, 5),
    feedback:
      score >= 3.5
        ? `Covers the key ${skill} concepts.`
        : `Graded offline against the answer key — expand on the concepts listed as missing.`,
  };
}

async function gradeConceptual(
  skill: string,
  question: StoredQuestion,
  userAnswer: string,
): Promise<z.infer<typeof ConceptualGrade>> {
  if (!env.GROQ_API_KEY || !userAnswer?.trim()) {
    return gradeConceptualHeuristic(skill, question.prompt, userAnswer, question.correct_answer);
  }
  try {
    const raw = await callGroq(
      `You are grading a student's conceptual answer for '${skill}'.

QUESTION: ${question.prompt}
ANSWER KEY: ${question.correct_answer}
STUDENT RESPONSE: ${userAnswer}

Score 0.0-5.0 on technical accuracy and completeness. Do not reward length.
Return ONLY:
{"score_0_to_5":4.0,"demonstrated_concepts":["..."],"missing_concepts":["..."],"feedback":"..."}`,
      15_000,
    );
    return ConceptualGrade.parse(parseJsonFromLlm(raw));
  } catch (err) {
    logger.warn({ err, skill }, "Conceptual AI grading failed — using heuristic");
    return gradeConceptualHeuristic(skill, question.prompt, userAnswer, question.correct_answer);
  }
}

function proficiencyTier(weighted: number): string {
  if (weighted >= 90) return "Highly Proficient";
  if (weighted >= 75) return "Advanced";
  if (weighted >= 60) return "Intermediate";
  if (weighted >= 40) return "Developing";
  return "Beginner";
}

// ---------------------------------------------------------------------------
// POST /assessment/sessions — start an attempt
// ---------------------------------------------------------------------------

const StartSchema = z.object({
  skill: z.string().min(1).max(80),
  level: z.string().min(1).max(40).default("Intermediate"),
});

router.post(
  "/assessment/sessions",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { skill, level } = StartSchema.parse(req.body ?? {});
    const student = req.student!;

    const { questions, source, fallbackReason } = await generateQuestions(skill, level);
    const session = await createSession({ studentId: student.id, skill, level, questions });

    logger.info({ sessionId: session.id, skill, source }, "Assessment session created");

    res.json({
      sessionId: session.id,
      skill,
      level,
      questionSource: source,
      // Surfaced so the UI can say "standard question bank" instead of lying
      // about AI generation, which is what the old screen did.
      notice: fallbackReason ?? null,
      blueprint: {
        skill,
        assessment_structure: { mcq: 5, conceptual: 2, debugging: 2, practical: 1 },
        difficulty_distribution: { beginner: 3, intermediate: 4, advanced: 3 },
        evaluation_focus: ["fundamentals", "problem_solving", "practical_ability"],
      },
      // FIX #2a: correct_answer and explanation are stripped here.
      questions: toPublicQuestions(session.questions),
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /assessment/sessions/:sessionId/submit — grade an attempt
// ---------------------------------------------------------------------------

const SubmitSchema = z.object({
  answers: z.record(z.string(), z.string()),
});

router.post(
  "/assessment/sessions/:sessionId/submit",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { answers } = SubmitSchema.parse(req.body ?? {});
    const student = req.student!;

    const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
    const claim = await claimSession(sessionId, student.id);
    if (!claim.ok) {
      const status = claim.reason === "forbidden" ? 403 : claim.reason === "already_submitted" ? 409 : 404;
      throw new HttpError(status, `Assessment session ${claim.reason.replace(/_/g, " ")}`);
    }

    const { session } = claim;
    if (claim.isAlreadyGraded && session.result) {
      logger.info({ studentId: student.id, sessionId }, "Returning cached assessment result");
      res.json(session.result);
      return;
    }

    const skill = session.skill;

    const stats: Record<string, { score: number; max: number; weight: number }> = {
      mcq: { score: 0, max: 0, weight: CATEGORY_WEIGHTS.mcq },
      conceptual: { score: 0, max: 0, weight: CATEGORY_WEIGHTS.conceptual },
      debugging: { score: 0, max: 0, weight: CATEGORY_WEIGHTS.debugging },
      practical: { score: 0, max: 0, weight: CATEGORY_WEIGHTS.practical },
    };

    const evaluations: QuestionEvaluation[] = [];
    const demonstrated: string[] = [];
    const missing: string[] = [];
    let earned = 0;

    for (const q of session.questions) {
      const userAnswer = String(answers[q.id] ?? "").trim();

      let type = String(q.type ?? "mcq").toLowerCase();
      if (type === "problem-solving") type = "debugging";
      if (type === "coding") type = "practical";
      if (!stats[type]) type = "mcq";

      let isCorrect = false;
      let score = 0;
      let score05: number | null = null;
      let demo: string[] | null = null;
      let miss: string[] | null = null;
      let feedback: string | null = null;

      if (type === "conceptual") {
        const graded = await gradeConceptual(skill, q, userAnswer);
        score05 = graded.score_0_to_5;
        demo = graded.demonstrated_concepts;
        miss = graded.missing_concepts;
        feedback = graded.feedback;
        demonstrated.push(...demo);
        missing.push(...miss);
        score = Math.round((score05 / 5) * 100) / 10;
        isCorrect = score05 >= 3.5;
      } else {
        const graded = gradeObjective(userAnswer, q.correct_answer);
        isCorrect = graded.correct;
        score = graded.score;
      }

      earned += score;
      stats[type].score += score;
      stats[type].max += 10;

      evaluations.push({
        question_id: q.id,
        prompt: q.prompt,
        question_type: q.type,
        difficulty: q.difficulty,
        user_answer: userAnswer || "Not answered",
        // Safe to reveal NOW — the attempt is closed and cannot be resubmitted.
        correct_answer: q.correct_answer,
        is_correct: isCorrect,
        score,
        max_score: 10,
        explanation: q.explanation,
        score_0_to_5: score05,
        demonstrated_concepts: demo,
        missing_concepts: miss,
        feedback,
      });
    }

    // Renormalise weights across categories that actually appeared.
    const activeWeight = Object.values(stats).reduce((a, d) => a + (d.max > 0 ? d.weight : 0), 0);
    const weighted =
      activeWeight > 0
        ? Object.values(stats).reduce(
            (acc, d) => (d.max > 0 ? acc + (d.score / d.max) * 100 * (d.weight / activeWeight) : acc),
            0,
          )
        : 0;

    const weightedScore = Math.round(weighted * 10) / 10;
    const tier = proficiencyTier(weightedScore);
    const maxPoints = session.questions.length * 10;

    const categoryScores: CategoryScore[] = Object.entries(stats)
      .filter(([, d]) => d.max > 0)
      .map(([k, d]) => ({
        category: CATEGORY_LABELS[k] ?? k,
        score: d.score,
        max_score: d.max,
        percentage: Math.round((d.score / d.max) * 1000) / 10,
        weight: d.weight,
      }));

    try {
      await db
        .insert(assessmentsTable)
        .values({
          studentId: student.id,
          authUser: student.authUserId,
          skill,
          title: skill,
          skillName: skill,
          weightedScore: String(weightedScore),
          proficiencyTier: tier,
        })
        .onConflictDoUpdate({
          target: [assessmentsTable.studentId, assessmentsTable.skill],
          set: {
            weightedScore: sql`GREATEST(${assessmentsTable.weightedScore}, ${String(weightedScore)}::numeric)`,
            proficiencyTier: sql`CASE WHEN ${assessmentsTable.weightedScore} >= ${String(weightedScore)}::numeric
                                      THEN ${assessmentsTable.proficiencyTier} ELSE ${tier} END`,
            completedAt: new Date(),
          },
        });
    } catch (dbErr: any) {
      logger.error({ err: dbErr, studentId: student.id, skill }, "Failed to save assessment to database");
      throw new HttpError(500, "Couldn't save your results — please try again");
    }

    logger.info({ studentId: student.id, skill, weightedScore, tier }, "Assessment graded");

    const responsePayload = {
      skill,
      total_score: earned,
      max_score: maxPoints,
      percentage: maxPoints > 0 ? Math.round((earned / maxPoints) * 1000) / 10 : 0,
      weighted_score: weightedScore,
      competency_level: `${tier} Competency`,
      proficiency_tier: tier,
      category_scores: categoryScores,
      question_evaluations: evaluations,
      demonstrated_concepts: [...new Set(demonstrated)],
      missing_concepts: [...new Set(missing)],
      strengths: categoryScores
        .filter((c) => c.percentage >= 70)
        .map((c) => `Strong grasp of ${skill} ${c.category} (${c.percentage}%)`),
      growth_areas: categoryScores
        .filter((c) => c.percentage < 70)
        .map((c) => `Room to grow in ${skill} ${c.category} (${c.percentage}%)`),
      recommendations: [
        `Achieved '${tier}' in ${skill} with a weighted score of ${weightedScore}%.`,
        "Weights: MCQ 20%, Conceptual 20%, Debugging 20%, Practical 40%.",
      ],
    };

    await saveSessionResult(session.id, responsePayload);
    res.json(responsePayload);
  }),
);

// ---------------------------------------------------------------------------
// GET /assessments — the caller's own results only
// ---------------------------------------------------------------------------

router.get(
  "/assessments",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    // FIX #8: no student_id query param. You get your own rows, full stop.
    const rows = await db
      .select()
      .from(assessmentsTable)
      .where(eq(assessmentsTable.studentId, req.student!.id));
    res.json(rows);
  }),
);

// ---------------------------------------------------------------------------
// DEPRECATED — kept only to return a clear error to stale app builds.
// Delete once every client has shipped the new flow.
// ---------------------------------------------------------------------------

router.post("/assessment/generate", (_req, res) => {
  res.status(410).json({
    error: "Deprecated. Use POST /api/assessment/sessions.",
    code: "ENDPOINT_REMOVED",
  });
});

router.post("/assessment/evaluate", (_req, res) => {
  res.status(410).json({
    error: "Deprecated and insecure. Use POST /api/assessment/sessions/:sessionId/submit.",
    code: "ENDPOINT_REMOVED",
  });
});

export default router;
