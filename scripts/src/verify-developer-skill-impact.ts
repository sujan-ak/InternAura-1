import { calculateSkillGapImpact, StudentProfileInput, InternshipInput } from "@workspace/db/hybrid-scorer";

const devStudent: StudentProfileInput = {
  name: "Developer Student",
  degree: "B.Tech Computer Science",
  year: "3rd year",
  careerGoal: "Software Engineer",
  location: "Remote",
  workMode: "Remote",
  stipendPreference: "₹25k+/month",
  interests: ["Backend Development", "Cloud"],
  skills: ["JavaScript", "React"],
};

const devInternship: InternshipInput = {
  id: "20000000-0000-0000-0000-000000000002",
  title: "Backend Engineering Intern",
  company: "CloudScale Inc",
  description: "Build high-concurrency microservices using Node.js, Docker, PostgreSQL and REST APIs.",
  domain: "Software Engineering",
  location: "Remote",
  workMode: "Remote",
  duration: "6 months",
  stipend: "₹30k/month",
  requiredSkills: ["Node.js", "Docker", "PostgreSQL"],
  preferredSkills: ["TypeScript", "REST APIs", "Go"],
  experienceLevel: "Beginner",
};

async function testDevImpact() {
  console.log("=========================================================================");
  console.log(" TESTING DEVELOPER PROFILE SKILL GAP IMPACT PROJECTIONS");
  console.log("=========================================================================\n");

  console.log(`Student: ${devStudent.name} (${devStudent.skills.join(", ")})`);
  console.log(`Role: ${devInternship.title} @ ${devInternship.company}`);
  console.log(`Required: ${devInternship.requiredSkills.join(", ")}`);
  console.log(`Preferred: ${devInternship.preferredSkills.join(", ")}\n`);

  const missingSkills = ["Node.js", "Docker", "PostgreSQL", "TypeScript"];

  for (const skill of missingSkills) {
    const impact = await calculateSkillGapImpact(devStudent, devInternship, skill);
    console.log(`- Hypothetical Skill: "${skill}"`);
    console.log(`  Base Score: ${impact.currentScore}% -> Projected Score: ${impact.projectedScore}% (Gain: +${impact.delta}%)`);
    console.log(`  Badge Label: "${impact.formattedDelta}"\n`);
  }
}

testDevImpact().catch(console.error);

export {};
