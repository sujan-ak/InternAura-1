import { Router, type Response, type Request } from "express";
import { db, ensureTables, interactionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { SAMPLE_STUDENT } from "@workspace/db/seed";

const router = Router();

router.post("/interactions", async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const { studentId, internshipId, action, reason } = req.body;
    const effectiveStudentId = studentId || SAMPLE_STUDENT.id;

    if (!internshipId || !action) {
      return res.status(400).json({ error: "internshipId and action are required" });
    }

    const interactionData = {
      studentId: effectiveStudentId,
      internshipId,
      action: action as any,
      reason: reason || null,
    };

    const [inserted] = await db
      .insert(interactionsTable)
      .values(interactionData)
      .returning();

    return res.json({
      id: inserted.id,
      studentId: inserted.studentId,
      internshipId: inserted.internshipId,
      action: inserted.action,
      reason: inserted.reason || undefined,
      createdAt: inserted.createdAt ? inserted.createdAt.toISOString() : new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in POST /interactions:", error);
    return res.status(500).json({ error: "Failed to create interaction" });
  }
});

router.get("/interactions", async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const studentIdParam = req.query.student_id as string | undefined;
    const actionParam = req.query.action as string | undefined;

    let conditions = [];
    if (studentIdParam) {
      conditions.push(eq(interactionsTable.studentId, studentIdParam));
    }
    if (actionParam) {
      conditions.push(eq(interactionsTable.action, actionParam as any));
    }

    const rows = await db
      .select()
      .from(interactionsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const formatted = rows.map((r: any) => ({
      id: r.id,
      studentId: r.studentId,
      internshipId: r.internshipId,
      action: r.action,
      reason: r.reason || undefined,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    }));

    return res.json(formatted);
  } catch (error) {
    console.error("Error in GET /interactions:", error);
    return res.status(500).json({ error: "Failed to fetch interactions" });
  }
});

export default router;
