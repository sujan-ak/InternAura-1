/**
 * Student routes — CORRECTED
 * REPLACES: artifacts/api-server/src/routes/students.ts
 *
 * FIX #5 + #8 — THE CROSS-ACCOUNT LEAK
 * ------------------------------------
 * The old GET /students/me ended with:
 *
 *     // Default fallback (e.g. seeded Aarav Mehta)
 *     const students = await db.select().from(studentsTable);
 *     if (students.length > 0) return res.json(students[0]);
 *
 * i.e. with no query param it returned WHOEVER WAS FIRST IN THE TABLE. The
 * resume-analyzer screen called it exactly that way, so a logged-in student's
 * extracted skills were merged onto a stranger's profile — and that row's
 * name/degree/careerGoal were overwritten with hardcoded "Aarav Mehta" defaults.
 *
 * The old POST /students also accepted `id` from the body with no auth, so any
 * caller could overwrite any profile.
 *
 * Both now resolve identity from the verified JWT only. The seeded fallback is
 * gone: no token means 401, no profile means 404 + NO_PROFILE (client routes to
 * onboarding), never someone else's data.
 *
 * FIX #11 — skills are canonicalised on write, so the scorer and the resume
 * parser can no longer disagree about whether "React.js" is "React".
 */

import { Router, type Request, type Response, type IRouter } from "express";
import { db, studentsTable } from "@workspace/db";
import { canonicalizeSkills } from "@workspace/db/skill-normalizer";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireAuthUserOnly } from "../middlewares/auth";
import { asyncHandler } from "../middlewares/error-handler";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * FIX #23: the workspace generates Zod schemas in lib/api-zod and the ONLY place
 * that imported any of them was routes/health.ts. Every other route destructured
 * req.body raw and cast to `any`. Validate for real.
 *
 * Note there is deliberately no `id` field — you cannot target another row.
 */
const UpsertStudentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  degree: z.string().trim().min(1).max(160),
  year: z.string().trim().min(1).max(60),
  careerGoal: z.string().trim().min(1).max(160),
  location: z.string().trim().min(1).max(120),
  workMode: z.string().trim().min(1).max(60),
  stipendPreference: z.string().trim().min(1).max(60),
  interests: z.array(z.string().trim().min(1)).max(40).default([]),
  skills: z.array(z.string().trim().min(1)).max(200).default([]),
});

/** Partial update — used by the resume analyzer, which only touches skills. */
const PatchStudentSchema = UpsertStudentSchema.partial();

// ---------------------------------------------------------------------------
// GET /students/me
// ---------------------------------------------------------------------------

router.get(
  "/students/me",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    // requireAuth already resolved and verified this row.
    const [row] = await db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.id, req.student!.id))
      .limit(1);
    res.json(row);
  }),
);

// ---------------------------------------------------------------------------
// POST /students — create or update the CALLER's profile
// ---------------------------------------------------------------------------

router.post(
  "/students",
  requireAuthUserOnly, // tolerates "no profile yet" — this is how one gets created
  asyncHandler(async (req: Request, res: Response) => {
    const body = UpsertStudentSchema.parse(req.body ?? {});
    const authUserId = req.authUserId!;

    const values = {
      ...body,
      skills: canonicalizeSkills(body.skills),
      authUser: authUserId,
    };

    // FIX #19: relies on the UNIQUE index on students.auth_user_id added in
    // patches/sql/001_fix_schema.sql. Without it the old code did
    // select-then-branch, which raced under concurrent onboarding submits and
    // could create two profiles for one account.
    const [saved] = await db
      .insert(studentsTable)
      .values(values)
      .onConflictDoUpdate({ target: studentsTable.authUser, set: values })
      .returning();

    logger.info({ studentId: saved.id }, "Student profile saved");
    res.json(saved);
  }),
);

// ---------------------------------------------------------------------------
// PATCH /students/me — partial update (resume analyzer uses this)
// ---------------------------------------------------------------------------

router.patch(
  "/students/me",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const body = PatchStudentSchema.parse(req.body ?? {});
    const patch: Record<string, unknown> = { ...body };
    if (body.skills) patch.skills = canonicalizeSkills(body.skills);

    if (Object.keys(patch).length === 0) {
      const [row] = await db
        .select()
        .from(studentsTable)
        .where(eq(studentsTable.id, req.student!.id));
      res.json(row);
      return;
    }

    const [updated] = await db
      .update(studentsTable)
      .set(patch)
      .where(eq(studentsTable.id, req.student!.id))
      .returning();

    res.json(updated);
  }),
);

// ---------------------------------------------------------------------------
// PUT /students/me/skills — merge skills without touching the rest
// ---------------------------------------------------------------------------

const SkillsSchema = z.object({
  skills: z.array(z.string().trim().min(1)).max(200),
  /** replace = user curated the full list; merge = additive from a resume. */
  mode: z.enum(["merge", "replace"]).default("merge"),
});

router.put(
  "/students/me/skills",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { skills, mode } = SkillsSchema.parse(req.body ?? {});

    const next =
      mode === "replace"
        ? canonicalizeSkills(skills)
        : canonicalizeSkills([...req.student!.skills, ...skills]);

    const [updated] = await db
      .update(studentsTable)
      .set({ skills: next })
      .where(eq(studentsTable.id, req.student!.id))
      .returning();

    logger.info({ studentId: req.student!.id, count: next.length, mode }, "Skills updated");
    res.json(updated);
  }),
);

export default router;
