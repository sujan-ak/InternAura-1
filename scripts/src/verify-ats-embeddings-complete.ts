import path from "path";
import fs from "fs";
import {
  getHuggingFaceEmbedding,
  computeVectorCosineSimilarity,
  computeCosineSimilarity,
  calculateHybridScore,
  type StudentProfileInput,
  type InternshipInput,
} from "@workspace/db/hybrid-scorer";

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

async function runVerificationSuite() {
  console.log("=================================================================");
  console.log("     ATS SCORE & HUGGING FACE MINI-LM EMBEDDINGS VERIFICATION     ");
  console.log("=================================================================");

  const apiKey = process.env.HUGGINGFACE_API_KEY;
  console.log(`[INIT] Configured HUGGINGFACE_API_KEY: ${apiKey ? `${apiKey.substring(0, 10)}...` : "NOT SET"}\n`);

  // -------------------------------------------------------------------------
  // VERIFICATION A: Real HF Inference API call showing embedding vector
  // -------------------------------------------------------------------------
  console.log("--- VERIFICATION A: Real HF Inference API Call ---");
  const studentAText = "Product Designer skilled in Figma User Research Prototyping Design Systems AI Interfaces";
  const studentBText = "Data Analyst skilled in SQL Python Tableau Pandas ETL Pipelines Data Warehousing";
  const internshipText = "Product Design Intern at Northstar Labs. Required: Figma, User Research. Preferred: Prototyping, Design Systems.";

  console.log(`Requesting MiniLM embedding for Student A text ("${studentAText.substring(0, 45)}...")...`);
  const vecStudentA = await getHuggingFaceEmbedding(studentAText);

  console.log(`Requesting MiniLM embedding for Internship text ("${internshipText.substring(0, 45)}...")...`);
  const vecInternship = await getHuggingFaceEmbedding(internshipText);

  if (vecStudentA && vecInternship) {
    console.log(`[VERIFICATION A PASSED] Successfully retrieved HF MiniLM embeddings!`);
    console.log(`Student A Vector Dimensions: ${vecStudentA.length}`);
    console.log(`Student A Vector Sample (first 5 dims): [${vecStudentA.slice(0, 5).map((n) => n.toFixed(5)).join(", ")}]`);
    console.log(`Internship Vector Dimensions: ${vecInternship.length}`);
    console.log(`Internship Vector Sample (first 5 dims): [${vecInternship.slice(0, 5).map((n) => n.toFixed(5)).join(", ")}]\n`);
  } else {
    console.log(`[VERIFICATION A FALLBACK ACTIVE] HF Inference API returned null (503/403/timeout). Operating cleanly with TF-IDF vector fallback.\n`);
  }

  // -------------------------------------------------------------------------
  // VERIFICATION B: Different Students Get Different Semantic Similarity Scores
  // -------------------------------------------------------------------------
  console.log("--- VERIFICATION B: Distinct Student Vector Cosine Similarity ---");
  const vecStudentB = await getHuggingFaceEmbedding(studentBText);

  const studentAProfile: StudentProfileInput = {
    id: "student-design-01",
    name: "Design Student",
    degree: "B.Des · Interaction Design",
    year: "3rd year",
    careerGoal: "Product Designer",
    location: "Bengaluru",
    workMode: "Hybrid",
    stipendPreference: "₹30k+/month",
    interests: ["Design Systems", "User Research"],
    skills: ["Figma", "User Research", "Prototyping"],
  };

  const studentBProfile: StudentProfileInput = {
    id: "student-data-02",
    name: "Data Student",
    degree: "B.Tech · Data Science",
    year: "4th year",
    careerGoal: "Data Analyst",
    location: "Delhi",
    workMode: "On-site",
    stipendPreference: "₹25k+/month",
    interests: ["Data Analytics", "SQL Databases"],
    skills: ["SQL", "Python", "Tableau"],
  };

  const sampleInternship: InternshipInput = {
    id: "10000000-0000-0000-0000-000000000001",
    title: "Product Design Intern",
    company: "Northstar Labs",
    description: "Shape the next generation of tools for creative teams. Work with product, engineering, and research from first sketch to final release.",
    domain: "Product & Design",
    location: "Bengaluru",
    workMode: "Hybrid",
    duration: "6 months",
    stipend: "₹35k / month",
    education: "B.Des or interaction design",
    requiredSkills: ["Figma", "User Research"],
    preferredSkills: ["Prototyping", "Design Systems"],
    experienceLevel: "Intermediate",
    embeddingVector: vecInternship,
  };

  const recStudentA = await calculateHybridScore(studentAProfile, sampleInternship, [], [], {
    studentEmbedding: vecStudentA,
    internshipEmbedding: vecInternship,
  });

  const recStudentB = await calculateHybridScore(studentBProfile, sampleInternship, [], [], {
    studentEmbedding: vecStudentB,
    internshipEmbedding: vecInternship,
  });

  console.log(`Student A (Product Designer) -> Internship (Product Design):`);
  console.log(`  - Semantic Similarity: ${recStudentA.atsBreakdown.semanticSimPct}% (${recStudentA.atsBreakdown.semanticMethodUsed})`);
  console.log(`  - Skill Match: ${recStudentA.atsBreakdown.skillMatchPct}%`);
  console.log(`  - Composite ATS Score: ${recStudentA.atsScore}%`);

  console.log(`\nStudent B (Data Analyst) -> Internship (Product Design):`);
  console.log(`  - Semantic Similarity: ${recStudentB.atsBreakdown.semanticSimPct}% (${recStudentB.atsBreakdown.semanticMethodUsed})`);
  console.log(`  - Skill Match: ${recStudentB.atsBreakdown.skillMatchPct}%`);
  console.log(`  - Composite ATS Score: ${recStudentB.atsScore}%`);

  const scoresAreDifferent = recStudentA.atsScore !== recStudentB.atsScore && recStudentA.atsBreakdown.semanticSimPct !== recStudentB.atsBreakdown.semanticSimPct;
  console.log(`\n[VERIFICATION B RESULT] ${scoresAreDifferent ? "PASSED: Distinct students received DIFFERENT semantic similarity & ATS Scores!" : "FAILED: Scores are identical."}\n`);

  // -------------------------------------------------------------------------
  // VERIFICATION C: Forced HF Timeout/Failure Fallback to TF-IDF
  // -------------------------------------------------------------------------
  console.log("--- VERIFICATION C: Forced HF Failure Fallback to TF-IDF ---");
  const recFallback = await calculateHybridScore(studentAProfile, sampleInternship, [], [], {
    studentEmbedding: null, // Simulate HF API failure/timeout returning null vector
    internshipEmbedding: null,
  });

  console.log(`Fallback Scoring Results for Student A:`);
  console.log(`  - Semantic Similarity: ${recFallback.atsBreakdown.semanticSimPct}% (${recFallback.atsBreakdown.semanticMethodUsed})`);
  console.log(`  - Composite ATS Score: ${recFallback.atsScore}%`);
  console.log(`  - Score breakdown intact: ${recFallback.atsBreakdown.skillMatchPct}% skill, ${recFallback.atsBreakdown.domainEduFitPct}% fit`);

  const fallbackPassed = recFallback.atsBreakdown.semanticMethodUsed === "TF-IDF Vector" && typeof recFallback.atsScore === "number" && recFallback.atsScore > 0;
  console.log(`\n[VERIFICATION C RESULT] ${fallbackPassed ? "PASSED: TF-IDF fallback executed cleanly without breaking scoring!" : "FAILED: Fallback broken."}\n`);
}

runVerificationSuite();
