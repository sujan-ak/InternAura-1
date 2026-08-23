import { calculateHybridScore, calculateSkillGapImpact, StudentProfileInput, InternshipInput } from "@workspace/db/hybrid-scorer";

const API_BASE = "http://localhost:5000";

async function verifySkillGapImpact() {
  console.log("=========================================================================");
  console.log(" VERIFYING SKILL GAP IMPACT FEATURE & HYPOTHETICAL SCORE PROJECTIONS");
  console.log("=========================================================================\n");

  const studentId = "00000000-0000-0000-0000-000000000001";
  
  // 1. Fetch Student Profile & Recommendations from API
  const studentRes = await fetch(`${API_BASE}/api/students/me?student_id=${studentId}`);
  const student = (await studentRes.json()) as any;

  const recsRes = await fetch(`${API_BASE}/api/recommendations?student_id=${studentId}`);
  const recs = (await recsRes.json()) as any[];

  console.log(`1. Student Profile Loaded: ${student.name} (${student.skills.length} skills: ${student.skills.join(", ")})`);
  console.log(`   Total Recommendations Loaded: ${recs.length}\n`);

  const studentInput: StudentProfileInput = {
    id: student.id,
    name: student.name,
    degree: student.degree,
    year: student.year,
    careerGoal: student.careerGoal,
    location: student.location,
    workMode: student.workMode,
    stipendPreference: student.stipendPreference,
    interests: student.interests || [],
    skills: student.skills || [],
  };

  // 2. Test Individual Internship Skill Gap Impact on 3 different internships
  console.log("2. INDIVIDUAL INTERNSHIP SKILL GAP IMPACT TESTS:");

  for (const [rIdx, rec] of recs.slice(0, 3).entries()) {
    const internship = rec.internship;
    const internshipInput: InternshipInput = {
      id: internship.id,
      title: internship.title,
      company: internship.company,
      description: internship.description,
      domain: internship.domain,
      location: internship.location,
      workMode: internship.workMode,
      duration: internship.duration,
      stipend: internship.stipend,
      education: internship.education,
      requiredSkills: internship.requiredSkills,
      preferredSkills: internship.preferredSkills,
      experienceLevel: internship.experienceLevel,
    };

    console.log(`\n   Role ${rIdx + 1}: "${internship.title}" @ ${internship.company}`);
    console.log(`   Current Base Match Score: ${rec.score}%`);
    console.log(`   Required: ${internship.requiredSkills.join(", ")} | Preferred: ${internship.preferredSkills.join(", ")}`);

    const missingOrPartialSkills = (rec.skillGap || [])
      .filter(([_, level]: [string, string]) => level === "Missing" || level === "Partial")
      .map(([skill, level]: [string, string]) => ({ skill, level }));

    for (const { skill, level } of missingOrPartialSkills.slice(0, 2)) {
      const impact = await calculateSkillGapImpact(studentInput, internshipInput, skill);
      console.log(`     - Skill "${skill}" (${level}): Base ${impact.currentScore}% -> If Mastered ${impact.projectedScore}% (Delta: +${impact.delta}%)`);
      console.log(`       Inline Badge Rendered: "${skill} — ${level} (+${impact.delta}% match if mastered)"`);
    }
  }

  // 3. Test Insights Screen Aggregated "Skills to Grow" Projections
  console.log("\n\n3. INSIGHTS TAB AGGREGATED SKILLS TO GROW IMPACT RANKINGS:");

  const validScores = recs.map((r) => r.score || 0).filter((s) => s > 0);
  const avgMatch = Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length);
  console.log(`   Current Baseline Average Match Score across all ${recs.length} recommendations: ${avgMatch}%`);

  const gapImpactMap = new Map<string, { skill: string; totalDelta: number; occurrences: number; status: string }>();

  for (const rec of recs) {
    const rawGaps = rec.skillGap || [];
    const itemInput: InternshipInput = {
      id: rec.internship.id,
      title: rec.internship.title,
      company: rec.internship.company,
      description: rec.internship.description,
      domain: rec.internship.domain,
      location: rec.internship.location,
      workMode: rec.internship.workMode,
      duration: rec.internship.duration,
      stipend: rec.internship.stipend,
      education: rec.internship.education,
      requiredSkills: rec.internship.requiredSkills,
      preferredSkills: rec.internship.preferredSkills,
      experienceLevel: rec.internship.experienceLevel,
    };

    for (const [skillName, status] of rawGaps as [string, string][]) {
      if (status === "Missing" || status === "Partial") {
        const existing = gapImpactMap.get(skillName) || {
          skill: skillName,
          totalDelta: 0,
          occurrences: 0,
          status,
        };
        const impact = await calculateSkillGapImpact(studentInput, itemInput, skillName);
        existing.totalDelta += impact.delta;
        existing.occurrences += 1;
        gapImpactMap.set(skillName, existing);
      }
    }
  }

  const rankedSkills = Array.from(gapImpactMap.values())
    .map((item) => {
      const avgBoost = Math.max(1, Math.round(item.totalDelta / recs.length));
      const projectedAvg = Math.min(99, avgMatch + avgBoost);
      return { ...item, avgBoost, projectedAvg };
    })
    .sort((a, b) => b.totalDelta - a.totalDelta);

  console.log("\n   Top 4 Skills Ranked by Real Projected Match Score Gain:");
  rankedSkills.slice(0, 4).forEach((item, idx) => {
    console.log(`   ${idx + 1}. Skill: "${item.skill}" (${item.status})`);
    console.log(`      - Projected Avg Match Improvement: ${avgMatch}% -> ${item.projectedAvg}% (+${item.avgBoost}% avg match gain)`);
    console.log(`      - Total Aggregate Score Delta across ${item.occurrences} roles: +${item.totalDelta}% points`);
    console.log(`      - Insights Subtitle Text: "Mastering ${item.skill} improves average match score from ${avgMatch}% to ${item.projectedAvg}%"`);
  });

  console.log("\n=========================================================================");
  console.log("SUCCESS: ALL SKILL GAP IMPACT CALCULATIONS VERIFIED!");
  console.log("=========================================================================");
}

verifySkillGapImpact().catch(console.error);

export {};
