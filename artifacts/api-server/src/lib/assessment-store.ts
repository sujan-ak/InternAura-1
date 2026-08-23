/**
 * Server-side assessment session store — fixes gap #2 and provides PostgreSQL persistence.
 * PLACE AT: artifacts/api-server/src/lib/assessment-store.ts
 */

import { randomUUID } from "crypto";
import { pool } from "@workspace/db";
import { logger } from "./logger";

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
  result?: any;
}

const SESSION_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours
const sessions = new Map<string, AssessmentSession>();

function sweep(): void {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, s] of sessions) if (s.createdAt < cutoff) sessions.delete(id);
}

export async function createSession(input: {
  studentId: string;
  skill: string;
  level: string;
  questions: StoredQuestion[];
}): Promise<AssessmentSession> {
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

  // Persist to PostgreSQL so sessions survive server reloads & worker processes
  if (pool) {
    pool.query(
      `INSERT INTO assessment_sessions (id, student_id, skill, level, questions, created_at, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, NULL)
       ON CONFLICT (id) DO NOTHING`,
      [session.id, session.studentId, session.skill, session.level, JSON.stringify(session.questions), session.createdAt]
    ).catch((err: any) => {
      logger.warn({ err, sessionId: session.id }, "Failed to asynchronously persist assessment session to DB");
    });
  }

  return session;
}

/**
 * Look up a session, enforcing ownership and single-submission.
 * Recovers session from PostgreSQL if the server restarted mid-assessment.
 */
export async function claimSession(
  sessionId: string,
  studentId: string,
): Promise<
  | { ok: true; session: AssessmentSession; isAlreadyGraded?: boolean }
  | { ok: false; reason: "not_found" | "expired" | "forbidden" | "already_submitted" }
> {
  let session = sessions.get(sessionId);

  // If not in in-memory Map (e.g. server restarted during quiz), query DB
  if (!session && pool) {
    try {
      const res = await pool.query(
        `SELECT id, student_id, skill, level, questions, created_at, submitted_at, result
         FROM assessment_sessions
         WHERE id = $1`,
        [sessionId]
      );
      if (res.rows.length > 0) {
        const row = res.rows[0];
        session = {
          id: row.id,
          studentId: row.student_id,
          skill: row.skill,
          level: row.level,
          questions: typeof row.questions === "string" ? JSON.parse(row.questions) : row.questions,
          createdAt: Number(row.created_at),
          submittedAt: row.submitted_at ? Number(row.submitted_at) : null,
          result: row.result ? (typeof row.result === "string" ? JSON.parse(row.result) : row.result) : undefined,
        };
        sessions.set(session.id, session);
      }
    } catch (dbErr) {
      logger.warn({ err: dbErr, sessionId }, "DB query for assessment session failed");
    }
  }

  if (!session) return { ok: false, reason: "not_found" };
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    return { ok: false, reason: "expired" };
  }
  // Identity comes from the verified JWT, never from the body.
  if (session.studentId !== studentId) return { ok: false, reason: "forbidden" };

  // If already graded and result is cached, allow idempotent retrieval of the result
  if (session.result) {
    return { ok: true, session, isAlreadyGraded: true };
  }

  if (session.submittedAt !== null) {
    return { ok: false, reason: "already_submitted" };
  }

  session.submittedAt = Date.now();
  if (pool) {
    pool.query(`UPDATE assessment_sessions SET submitted_at = $1 WHERE id = $2`, [session.submittedAt, session.id]).catch(() => {});
  }
  return { ok: true, session };
}

export async function saveSessionResult(sessionId: string, result: any): Promise<void> {
  const session = sessions.get(sessionId);
  const now = Date.now();
  if (session) {
    session.result = result;
    session.submittedAt = session.submittedAt ?? now;
  }
  if (pool) {
    pool.query(
      `UPDATE assessment_sessions SET result = $1, submitted_at = COALESCE(submitted_at, $2) WHERE id = $3`,
      [JSON.stringify(result), now, sessionId]
    ).catch(() => {});
  }
}

/** Strip the answer key before anything reaches a client. */
export function toPublicQuestions(questions: StoredQuestion[]): PublicQuestion[] {
  return questions.map(({ correct_answer, explanation, ...rest }) => rest);
}

export function sessionCount(): number {
  return sessions.size;
}
