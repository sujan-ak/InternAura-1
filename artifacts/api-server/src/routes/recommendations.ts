import { Router, type Response, type Request } from "express";
import { db, ensureTables, recommendationsTable, internshipsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { seedDatabase } from "@workspace/db/seed";

const router = Router();

function normalizeSkillGap(input: any): [string, string][] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map((item) => {
      if (Array.isArray(item)) {
        return [String(item[0]), String(item[1])];
      }
      if (typeof item === "object" && item !== null) {
        return [String(item.name || item.skill), String(item.level || "Strong")];
      }
      return [String(item), "Strong"];
    });
  }
  if (typeof input === "object") {
    return Object.entries(input).map(([skill, level]) => [String(skill), String(level)]);
  }
  return [];
}

function normalizeReasons(input: any): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((r) => String(r));
  if (typeof input === "string") return [input];
  return [];
}

router.get("/recommendations", async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const studentIdParam = req.query.student_id as string | undefined;

    let query = db
      .select({
        studentId: recommendationsTable.studentId,
        internshipId: recommendationsTable.internshipId,
        score: recommendationsTable.score,
        reasons: recommendationsTable.reasons,
        skillGap: recommendationsTable.skillGap,
        internship: internshipsTable,
      })
      .from(recommendationsTable)
      .innerJoin(internshipsTable, eq(recommendationsTable.internshipId, internshipsTable.id));

    if (studentIdParam) {
      query = query.where(eq(recommendationsTable.studentId, studentIdParam)) as typeof query;
    }

    let rows = await query;
    if (rows.length === 0) {
      await seedDatabase();
      rows = await query;
    }

    const formatted = rows.map((r: any) => ({
      studentId: r.studentId,
      internshipId: r.internshipId,
      score: Number(r.score),
      reasons: normalizeReasons(r.reasons),
      skillGap: normalizeSkillGap(r.skillGap),
      internship: r.internship,
    }));

    formatted.sort((a: any, b: any) => b.score - a.score);
    return res.json(formatted);
  } catch (error) {
    console.error("Error in GET /recommendations:", error);
    return res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

export default router;
