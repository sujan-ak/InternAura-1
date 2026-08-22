import { Router, type Response, type Request } from "express";
import { db, ensureTables, studentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SAMPLE_STUDENT, seedDatabase } from "@workspace/db/seed";

const router = Router();

router.post("/students", async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const { id, name, degree, year, careerGoal, location, workMode, stipendPreference, interests, skills } = req.body;

    const studentData = {
      id: id || "00000000-0000-0000-0000-000000000001",
      name: name || "Aarav Mehta",
      degree: degree || "B.Des · Interaction Design",
      year: year || "3rd year",
      careerGoal: careerGoal || "Product Designer",
      location: location || "Bengaluru",
      workMode: workMode || "Hybrid",
      stipendPreference: stipendPreference || "₹30k+/month",
      interests: interests || [],
      skills: skills || [],
    };

    const existing = await db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.id, studentData.id));

    if (existing.length > 0) {
      const [updated] = await db
        .update(studentsTable)
        .set(studentData)
        .where(eq(studentsTable.id, studentData.id))
        .returning();
      return res.json(updated);
    } else {
      const [created] = await db
        .insert(studentsTable)
        .values(studentData)
        .returning();
      return res.json(created);
    }
  } catch (error) {
    console.error("Error in POST /students:", error);
    return res.status(500).json({ error: "Failed to create or update student profile" });
  }
});

router.get("/students/me", async (_req: Request, res: Response) => {
  try {
    await ensureTables();
    const students = await db.select().from(studentsTable);
    if (students.length > 0) {
      return res.json(students[0]);
    }
    // Auto-seed if database was empty
    await seedDatabase();
    const seeded = await db.select().from(studentsTable);
    if (seeded.length > 0) {
      return res.json(seeded[0]);
    }
    return res.status(404).json({ error: "Profile not found" });
  } catch (error) {
    console.error("Error in GET /students/me:", error);
    return res.status(500).json({ error: "Failed to fetch student profile" });
  }
});

export default router;
