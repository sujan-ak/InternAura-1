import path from "path";
import fs from "fs";

function loadEnv() {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../.env"),
    path.resolve(process.cwd(), "../../.env"),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      try {
        process.loadEnvFile(file);
      } catch {}
      break;
    }
  }
}
loadEnv();

import { db, studentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function testConfirmResumeSkillsUpdate() {
  console.log("=================================================");
  console.log(" TEST: CONFIRM SKILLS UPDATE TO SUPABASE DATABASE ");
  console.log("=================================================");

  const pdfPath = path.resolve(process.cwd(), "sample_resume.pdf");
  const fileBuffer = fs.readFileSync(pdfPath);
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: "application/pdf" });
  formData.append("file", blob, "sample_resume.pdf");

  // 1. Analyze PDF
  const analyzeRes = await fetch("http://localhost:5000/api/resume/analyze", {
    method: "POST",
    body: formData,
  });
  const analyzeData = (await analyzeRes.json()) as any;
  console.log("\n1. Analyzed PDF Extracted Skills:", analyzeData.skills.map((s: any) => s.name));

  // 2. Fetch current student
  const studentId = "00000000-0000-0000-0000-000000000001";
  const existingRows = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId));
  const currentSkills: string[] = (existingRows[0]?.skills as string[]) || [];

  console.log("2. Current Student Skills before merge:", currentSkills);

  // 3. Merge new extracted skills
  const newSkills = analyzeData.skills.map((s: any) => s.name).filter((s: string) => s !== "SKILLS");
  const mergedSkills = Array.from(new Set([...currentSkills, ...newSkills]));

  console.log("3. Merged Skills to Save:", mergedSkills);

  // 4. Update student profile via API
  const updateRes = await fetch("http://localhost:5000/api/students", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: studentId,
      name: existingRows[0]?.name || "Aarav Mehta",
      degree: existingRows[0]?.degree || "B.Des · Interaction Design",
      year: existingRows[0]?.year || "3rd year",
      careerGoal: existingRows[0]?.careerGoal || "Product Designer",
      location: existingRows[0]?.location || "Bengaluru",
      workMode: existingRows[0]?.workMode || "Hybrid",
      stipendPreference: existingRows[0]?.stipendPreference || "₹30k+/month",
      interests: existingRows[0]?.interests || ["Design Systems"],
      skills: mergedSkills,
    }),
  });

  console.log("4. API Profile Update Status:", updateRes.status);

  // 5. Query live Supabase DB directly to verify persistence
  const updatedDbRows = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId));
  console.log("\n=================================================");
  console.log(" VERIFIED UPDATED STUDENT ROW FROM SUPABASE DB: ");
  console.log("=================================================");
  console.log("Student Name:", updatedDbRows[0].name);
  console.log("Student ID  :", updatedDbRows[0].id);
  console.log("Updated Skills Array:", updatedDbRows[0].skills);
  console.log("=================================================");
}

testConfirmResumeSkillsUpdate();
