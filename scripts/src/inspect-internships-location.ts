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

async function inspectInternshipsLocation() {
  try {
    console.log("Querying internships table for distinct locations...");
    const res = await pool.query(`SELECT DISTINCT location FROM internships`);
    console.log(`Found ${res.rows.length} distinct locations:`);
    res.rows.forEach((r: any, idx: number) => {
      console.log(` ${idx + 1}. "${r.location}"`);
    });
  } catch (err: any) {
    console.error("Error querying internships:", err.message);
  } finally {
    process.exit(0);
  }
}

inspectInternshipsLocation();
