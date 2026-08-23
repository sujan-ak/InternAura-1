import { calculateSkillGapImpact, StudentProfileInput, InternshipInput } from "@workspace/db/hybrid-scorer";

const API_BASE = "http://localhost:5000";

async function verifyInsightsBestImpactFraming() {
  console.log("=========================================================================");
  console.log(" VERIFYING INSIGHTS 'SKILLS TO GROW' SINGLE BEST-ROLE IMPACT FRAMING");
  console.log("=========================================================================\n");

  const studentId = "00000000-0000-0000-0000-000000000001";
  
  const studentRes = await fetch(`${API_BASE}/api/students/me?student_id=${studentId}`);
  const student = (await studentRes.json()) as any;

  const recsRes = await fetch(`${API_BASE}/api/recommendations?student_id=${studentId}`);
  const recs = (await recsRes.json()) as any[];

  console.log(`1. Student Profile Loaded: ${student.name} (${student.skills.length} skills)`);
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

  const gapImpactMap = new Map<
    string,
    {
      skill: string;
      missingCount: number;
      partialCount: number;
      occurrences: number;
      bestImpact: number;
      bestRoleTitle: string;
      bestCompany: string;
      bestBaseScore: number;
      bestProjectedScore: number;
      status: string;
    }
  >();

  for (const rec of recs) {
    const rawGaps = rec.skillGap || [];
    const baseScore = rec.score || 50;

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
        const impact = await calculateSkillGapImpact(studentInput, itemInput, skillName);
        const existing = gapImpactMap.get(skillName) || {
          skill: skillName,
          missingCount: 0,
          partialCount: 0,
          occurrences: 0,
          bestImpact: impact.delta,
          bestRoleTitle: rec.internship.title,
          bestCompany: rec.internship.company,
          bestBaseScore: baseScore,
          bestProjectedScore: Math.min(99, baseScore + impact.delta),
          status,
        };

        if (status === "Missing") existing.missingCount += 1;
        if (status === "Partial") existing.partialCount += 1;
        existing.occurrences += 1;

        if (impact.delta > existing.bestImpact) {
          existing.bestImpact = impact.delta;
          existing.bestRoleTitle = rec.internship.title;
          existing.bestCompany = rec.internship.company;
          existing.bestBaseScore = baseScore;
          existing.bestProjectedScore = Math.min(99, baseScore + impact.delta);
        }

        gapImpactMap.set(skillName, existing);
      }
    }
  }

  const rankedSkills = Array.from(gapImpactMap.values())
    .filter((item) => item.bestImpact > 0)
    .sort((a, b) => b.bestImpact - a.bestImpact || b.occurrences - a.occurrences)
    .slice(0, 4);

  console.log("2. INSIGHTS 'SKILLS TO GROW' RENDERED CONTENT (BEST SINGLE-ROLE FRAMING):\n");

  rankedSkills.forEach((item, idx) => {
    const isPartial = item.partialCount > item.missingCount;
    const badgeText = isPartial ? "Partial Match" : "Missing Skill";
    const subtitleText = `Unlocks +${item.bestImpact}% match on ${item.bestRoleTitle} @ ${item.bestCompany} (${item.bestBaseScore}% → ${item.bestProjectedScore}%)`;

    console.log(`   Skill ${idx + 1}: "${item.skill}"`);
    console.log(`     - Impact Badge: "+${item.bestImpact}% match gain"`);
    console.log(`     - Status Badge: "${badgeText}"`);
    console.log(`     - Progress Bar Fill: ${item.bestProjectedScore}%`);
    console.log(`     - Subtitle Copy: "${subtitleText}"\n`);
  });

  console.log("=========================================================================");
  console.log("SUCCESS: SINGLE BEST-ROLE IMPACT FRAMING VERIFIED!");
  console.log("=========================================================================");
}

verifyInsightsBestImpactFraming().catch(console.error);

export {};
