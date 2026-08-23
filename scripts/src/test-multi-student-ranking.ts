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

import { calculateHybridScore, type StudentProfileInput, type InternshipInput } from "@workspace/db/hybrid-scorer";
import { SAMPLE_INTERNSHIPS } from "@workspace/db/seed";

const studentA: StudentProfileInput = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Aarav Mehta",
  degree: "B.Des · Interaction Design",
  year: "3rd year",
  careerGoal: "Product Designer",
  location: "Bengaluru",
  workMode: "Hybrid",
  stipendPreference: "₹30k+/month",
  interests: ["Design Systems", "User Research", "AI Interfaces"],
  skills: ["Figma", "User Research", "Visual Design", "Prototyping"],
};

const studentB: StudentProfileInput = {
  id: "00000000-0000-0000-0000-000000000002",
  name: "Riya Sharma",
  degree: "B.Tech · Computer Science",
  year: "4th year",
  careerGoal: "Frontend Engineer",
  location: "Remote",
  workMode: "Remote",
  stipendPreference: "₹40k+/month",
  interests: ["Developer Tools", "E-commerce", "Fintech"],
  skills: ["JavaScript", "React", "TypeScript", "Node.js"],
};

async function runMultiStudentComparison() {
  console.log("=================================================");
  console.log(" DYNAMIC MULTI-STUDENT RE-RANKING DEMONSTRATION  ");
  console.log("=================================================");

  const internships: InternshipInput[] = SAMPLE_INTERNSHIPS as any;

  const ranksA = (
    await Promise.all(internships.map((item) => calculateHybridScore(studentA, item)))
  ).sort((a, b) => b.score - a.score);

  const ranksB = (
    await Promise.all(internships.map((item) => calculateHybridScore(studentB, item)))
  ).sort((a, b) => b.score - a.score);

  console.log(`\n--- TOP 3 RECOMMENDATIONS FOR ${studentA.name.toUpperCase()} (${studentA.careerGoal}) ---`);
  ranksA.slice(0, 3).forEach((r, index) => {
    console.log(`${index + 1}. [${r.score}% Match] ${r.internship.title} at ${r.internship.company}`);
    console.log(`   Reasons: ${JSON.stringify(r.reasons)}`);
    console.log(`   Skill Gap: ${JSON.stringify(r.skillGap)}`);
  });

  console.log(`\n--- TOP 3 RECOMMENDATIONS FOR ${studentB.name.toUpperCase()} (${studentB.careerGoal}) ---`);
  ranksB.slice(0, 3).forEach((r, index) => {
    console.log(`${index + 1}. [${r.score}% Match] ${r.internship.title} at ${r.internship.company}`);
    console.log(`   Reasons: ${JSON.stringify(r.reasons)}`);
    console.log(`   Skill Gap: ${JSON.stringify(r.skillGap)}`);
  });

  console.log("\n=================================================");
  console.log("SUMMARY: Student A top match is:", ranksA[0].internship.title);
  console.log("SUMMARY: Student B top match is:", ranksB[0].internship.title);
  console.log("=================================================");
}

runMultiStudentComparison();
