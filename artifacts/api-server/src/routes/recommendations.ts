import { Router, type Response, type Request } from "express";
import { db, studentsTable, internshipsTable, interactionsTable, assessmentsTable } from "@workspace/db";
import { eq, or, and, gte } from "drizzle-orm";
import { seedDatabase } from "@workspace/db/seed";
import { calculateHybridScore, type StudentProfileInput } from "@workspace/db/hybrid-scorer";

const router = Router();

router.get("/recommendations", async (req: Request, res: Response) => {
  try {
    const studentIdParam = (req.query.student_id as string | undefined) || "00000000-0000-0000-0000-000000000001";

    let students = await db
      .select()
      .from(studentsTable)
      .where(or(eq(studentsTable.id, studentIdParam), eq(studentsTable.authUser, studentIdParam)));
    let internships = await db.select().from(internshipsTable);

    if (internships.length === 0) {
      await seedDatabase();
      internships = await db.select().from(internshipsTable);
      students = await db
        .select()
        .from(studentsTable)
        .where(or(eq(studentsTable.id, studentIdParam), eq(studentsTable.authUser, studentIdParam)));
    }

    const currentStudent: StudentProfileInput = students.length > 0
      ? {
          id: students[0].id,
          name: students[0].name,
          degree: students[0].degree,
          year: students[0].year,
          careerGoal: students[0].careerGoal,
          location: students[0].location,
          workMode: students[0].workMode,
          stipendPreference: students[0].stipendPreference,
          interests: students[0].interests || [],
          skills: (students[0].skills as string[]) || [],
        }
      : {
          id: studentIdParam,
          name: "Aarav Mehta",
          degree: "B.Des · Interaction Design",
          year: "3rd year",
          careerGoal: "Product Designer",
          location: "Bengaluru",
          workMode: "Hybrid",
          stipendPreference: "₹30k+/month",
          interests: ["Design Systems", "User Research", "AI Interfaces"],
          skills: ["Figma", "User Research", "Visual Design", "React"],
        };

    const interactions = await db
      .select()
      .from(interactionsTable)
      .where(eq(interactionsTable.studentId, studentIdParam));

    let assessmentRecords: { skill: string; weightedScore: number }[] = [];
    try {
      const dbAssessments = await db
        .select({ skill: assessmentsTable.skill, weightedScore: assessmentsTable.weightedScore })
        .from(assessmentsTable)
        .where(
          or(
            eq(assessmentsTable.studentId, currentStudent.id!),
            eq(assessmentsTable.authUser, studentIdParam)
          )
        );
      assessmentRecords = dbAssessments
        .filter((a: any) => Number(a.weightedScore) >= 60)
        .map((a: any) => ({ skill: a.skill, weightedScore: Number(a.weightedScore) }));
    } catch (e) {
      console.warn("Could not query assessments table for recommendations:", e);
    }

    const { getHuggingFaceEmbedding } = await import("@workspace/db/hybrid-scorer");
    const studentText = `${currentStudent.careerGoal} ${currentStudent.degree} ${currentStudent.skills.join(" ")} ${currentStudent.interests.join(" ")}`;
    const studentEmbedding = await getHuggingFaceEmbedding(studentText);

    const formatted = await Promise.all(
      internships.map((internship: any) =>
        calculateHybridScore(currentStudent, internship, interactions as any[], assessmentRecords, { studentEmbedding })
      )
    );

    formatted.sort((a: any, b: any) => b.atsScore - a.atsScore);
    return res.json(formatted);
  } catch (error) {
    console.error("Error in GET /recommendations:", error);
    return res.status(500).json({ error: "Failed to fetch dynamic recommendations" });
  }
});

export default router;
