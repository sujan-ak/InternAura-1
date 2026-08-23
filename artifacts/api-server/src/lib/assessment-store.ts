/**
 * Server-side assessment session store — fixes gap #2.
 * PLACE AT: artifacts/api-server/src/lib/assessment-store.ts
 *
 * THE BUG THIS FIXES
 * ------------------
 * /assessment/generate returned `correct_answer` + `explanation` for all 10
 * questions, and /assessment/evaluate graded against the `questions` array the
 * CLIENT posted back. So:
 *   1. The answer key was on the device before the student answered anything.
 *   2. Anyone could POST a forged 100% for any student_id with one curl.
 *
 * Now the answer key never leaves the server. /generate stores it under a
 * sessionId; /evaluate looks it up and grades against the stored copy. The
 * client only ever posts { sessionId, answers }.
 *
 * PRODUCTION NOTE
 * ---------------
 * In-process Map = correct for one instance, WRONG for .replit's
 * `deploymentTarget = "autoscale"` (instance B won't have instance A's session).
 * Swap these four functions for Redis or an `assessment_sessions` table before
 * scaling out. The interface is deliberately tiny so that's a ~20 line change.
 */

import { randomUUID } from "crypto";

export interface StoredQuestion {
  id: string;
  type: string;
  prompt: string;
  options?: string[] | null;
  code_snippet?: string | null;
  starter_code?: string | null;
  correct_answer: string;
  explanation: string;
  difficulty: string;
}

/** What the client may see. Note: no correct_answer, no explanation. */
export type PublicQuestion = Omit<StoredQuestion, "correct_answer" | "explanation">;

export interface AssessmentSession {
  id: string;
  studentId: string;
  skill: string;
  level: string;
  questions: StoredQuestion[];
  createdAt: number;
  submittedAt: number | null;
}

const SESSION_TTL_MS = 45 * 60 * 1000;
const sessions = new Map<string, AssessmentSession>();

function sweep(): void {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, s] of sessions) if (s.createdAt < cutoff) sessions.delete(id);
}

export function createSession(input: {
  studentId: string;
  skill: string;
  level: string;
  questions: StoredQuestion[];
}): AssessmentSession {
  sweep();
  const session: AssessmentSession = {
    id: randomUUID(),
    studentId: input.studentId,
    skill: input.skill,
    level: input.level,
    questions: input.questions,
    createdAt: Date.now(),
    submittedAt: null,
  };
  sessions.set(session.id, session);
  return session;
}

/**
 * Look up a session, enforcing ownership and single-submission.
 * Returns a discriminated result so the route maps each failure to the right
 * status code instead of a generic 500.
 */
export function claimSession(
  sessionId: string,
  studentId: string,
):
  | { ok: true; session: AssessmentSession }
  | { ok: false; reason: "not_found" | "expired" | "forbidden" | "already_submitted" } {
  const session = sessions.get(sessionId);
  if (!session) return { ok: false, reason: "not_found" };
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    return { ok: false, reason: "expired" };
  }
  // Identity comes from the verified JWT, never from the body.
  if (session.studentId !== studentId) return { ok: false, reason: "forbidden" };
  if (session.submittedAt !== null) return { ok: false, reason: "already_submitted" };

  session.submittedAt = Date.now();
  return { ok: true, session };
}

/** Strip the answer key before anything reaches a client. */
export function toPublicQuestions(questions: StoredQuestion[]): PublicQuestion[] {
  return questions.map(({ correct_answer, explanation, ...rest }) => rest);
}

export function sessionCount(): number {
  return sessions.size;
}
