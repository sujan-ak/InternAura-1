import path from "path";
import fs from "fs";
import { pool } from "../../lib/db/src/index";

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

async function inspectRecommendations() {
  try {
    console.log("Querying recommendations table for stored reasons and skill_gap...");
    const res = await pool.query(`SELECT student_id, internship_id, score, reasons, skill_gap FROM recommendations LIMIT 5`);
    console.log(`Found ${res.rows.length} recommendation rows.`);
    res.rows.forEach((r: any, idx: number) => {
      console.log(`\n[Rec ${idx + 1}] Internship ID: ${r.internship_id} | Score: ${r.score}`);
      console.log(" Reasons:", JSON.stringify(r.reasons, null, 2));
      console.log(" Skill Gap:", JSON.stringify(r.skill_gap, null, 2));
    });
  } catch (err: any) {
    console.error("Error querying recommendations:", err.message);
  } finally {
    process.exit(0);
  }
}

inspectRecommendations();
