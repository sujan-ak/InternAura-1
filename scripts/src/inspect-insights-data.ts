const API_BASE = "http://localhost:5000";

async function inspectInsightsData() {
  console.log("=================================================");
  console.log(" INSPECTING RECOMMENDATIONS & SKILL GAPS DATA   ");
  console.log("=================================================\n");

  const studentId = "00000000-0000-0000-0000-000000000001";
  const res = await fetch(`${API_BASE}/api/recommendations?student_id=${studentId}`);
  const data = (await res.json()) as any;

  console.log(`Total recommendations returned: ${data.length}`);
  
  // Aggregate skill gaps across recommendations
  const missingSkillCounts: Record<string, number> = {};
  const partialSkillCounts: Record<string, number> = {};

  data.forEach((rec: any, idx: number) => {
    const rawGaps = rec.skillGap || rec.skillGaps || rec.skill_gap || [];
    if (idx < 3) {
      console.log(`\nRec ${idx + 1}: ${rec.internship?.title || rec.title} (Score ${rec.score}%)`);
      console.log("  Raw skillGap array:", rawGaps);
    }

    if (Array.isArray(rawGaps)) {
      rawGaps.forEach((item: any) => {
        let skill = "";
        let status = "";
        if (Array.isArray(item)) {
          skill = item[0];
          status = item[1];
        } else if (item && typeof item === "object") {
          skill = item.skill;
          status = item.status;
        }

        if (skill && status) {
          if (status === "Missing") {
            missingSkillCounts[skill] = (missingSkillCounts[skill] || 0) + 1;
          } else if (status === "Partial") {
            partialSkillCounts[skill] = (partialSkillCounts[skill] || 0) + 1;
          }
        }
      });
    }
  });

  console.log("\n--- AGGREGATED MISSING SKILLS ACROSS RECOMMENDATIONS ---");
  console.log(JSON.stringify(missingSkillCounts, null, 2));

  console.log("\n--- AGGREGATED PARTIAL SKILLS ACROSS RECOMMENDATIONS ---");
  console.log(JSON.stringify(partialSkillCounts, null, 2));
}

inspectInsightsData().catch(console.error);

export {};
