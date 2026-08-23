/**
 * Interaction routes — CORRECTED
 * REPLACES: artifacts/api-server/src/routes/interactions.ts
 *
 * FIX #3 — UN-SAVING WAS IMPOSSIBLE
 * ---------------------------------
 * `interactions` is append-only and there was NO delete endpoint anywhere in the
 * API. So AppContext's toggleSave() "unsaved" by inserting a `view` row:
 *
 *     logInteraction(id, isSaved ? "view" : "save");
 *
 * The original `save` row survived, savedIds still contained the id, and the
 * bookmark snapped straight back to filled. Three knock-on effects:
 *   - saved/applied counts inflated on every tap (no de-duplication)
 *   - the scorer's behaviour band (+20 per save row) let tap-spam inflate a
 *     job's ATS score
 *   - logView on every detail mount grew the table without bound
 *
 * This file adds DELETE /interactions and makes save/apply IDEMPOTENT: one row
 * per (student, internship, action), so N taps == 1 row. Requires the unique
 * index in patches/sql/001_fix_schema.sql.
 *
 * FIX #4 — Adzuna jobs could not be saved at all. internship_id is
 * `UUID NOT NULL REFERENCES internships(id)`, and live listings have ids like
 * "adzuna-4718392", so the insert threw a foreign-key violation that surfaced as
 * an unexplained 500. Handled explicitly with a real error message; see
 * patches/sql for the external-listing table that fixes it properly.
 *
 * FIX #8 — studentId no longer comes from the body (it used to fall back to the
 * seeded SAMPLE_STUDENT.id, so anonymous writes were attributed to the demo user).
 */

import { Router, type Request, type Response, type IRouter } from "express";
import { db, interactionsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth";
import { asyncHandler, HttpError } from "../middlewares/error-handler";

const router: IRouter = Router();

const ACTIONS = ["view", "save", "skip", "apply", "like"] as const;

const CreateSchema = z.object({
  internshipId: z.string().uuid({ message: "internshipId must be a UUID" }),
  action: z.enum(ACTIONS),
  reason: z.string().trim().max(500).optional().nullable(),
});

const ListSchema = z.object({
  action: z.enum(ACTIONS).optional(),
});

const DeleteSchema = z.object({
  internshipId: z.string().uuid(),
  action: z.enum(ACTIONS),
});

function isForeignKeyViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === "23503";
}

// ---------------------------------------------------------------------------
// POST /interactions — idempotent
// ---------------------------------------------------------------------------

router.post(
  "/interactions",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { internshipId, action, reason } = CreateSchema.parse(req.body ?? {});
    const studentId = req.student!.id;

    try {
      // One row per (student, internship, action). Re-tapping save just refreshes
      // created_at rather than stacking another row.
      const [row] = await db
        .insert(interactionsTable)
        .values({ studentId, internshipId, action, reason: reason ?? null })
        .onConflictDoUpdate({
          target: [
            interactionsTable.studentId,
            interactionsTable.internshipId,
            interactionsTable.action,
          ],
          set: { reason: reason ?? null, createdAt: new Date() },
        })
        .returning();

      res.json({
        id: row.id,
        studentId: row.studentId,
        internshipId: row.internshipId,
        action: row.action,
        reason: row.reason ?? undefined,
        createdAt: (row.createdAt ?? new Date()).toISOString(),
      });
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        // FIX #4: this is what silently 500'd on every Adzuna save.
        throw new HttpError(
          400,
          "That listing is not in the internships table. External listings must be imported before they can be saved.",
          "UNKNOWN_INTERNSHIP",
        );
      }
      throw err;
    }
  }),
);

// ---------------------------------------------------------------------------
// DELETE /interactions — the endpoint that never existed
// ---------------------------------------------------------------------------

router.delete(
  "/interactions",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { internshipId, action } = DeleteSchema.parse(req.body ?? {});

    const deleted = await db
      .delete(interactionsTable)
      .where(
        and(
          eq(interactionsTable.studentId, req.student!.id),
          eq(interactionsTable.internshipId, internshipId),
          eq(interactionsTable.action, action),
        ),
      )
      .returning();

    // 200 with a count rather than 404 — un-saving something already un-saved is
    // a no-op the client should treat as success.
    res.json({ deleted: deleted.length });
  }),
);

// ---------------------------------------------------------------------------
// GET /interactions — the caller's own rows only
// ---------------------------------------------------------------------------

router.get(
  "/interactions",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { action } = ListSchema.parse(req.query ?? {});

    // FIX #8: no student_id query param. Needs the index on
    // interactions(student_id) from patches/sql/001_fix_schema.sql — every read
    // filters on it and there wasn't one.
    const where = action
      ? and(eq(interactionsTable.studentId, req.student!.id), eq(interactionsTable.action, action))
      : eq(interactionsTable.studentId, req.student!.id);

    const rows = await db.select().from(interactionsTable).where(where);

    res.json(
      rows.map((r: any) => ({
        id: r.id,
        studentId: r.studentId,
        internshipId: r.internshipId,
        action: r.action,
        reason: r.reason ?? undefined,
        createdAt: new Date(r.createdAt ?? Date.now()).toISOString(),
      })),
    );
  }),
);

export default router;
