import path from "path";
import fs from "fs";
import pg from "pg";
const { Pool } = pg;

function loadEnv() {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../.env"),
    path.resolve(process.cwd(), "../../.env"),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      process.loadEnvFile(file);
      break;
    }
  }
}
loadEnv();

async function queryCounts() {
  console.log("=================================================");
  console.log("    LIVE SUPABASE DATABASE DIRECT ROW COUNTS     ");
  console.log("=================================================");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const studentsRes = await pool.query("SELECT count(*) FROM students");
    const internshipsRes = await pool.query("SELECT count(*) FROM internships");
    const recsRes = await pool.query("SELECT count(*) FROM recommendations");
    const intersRes = await pool.query("SELECT count(*) FROM interactions");

    console.log(`- SELECT count(*) FROM students;        => ${studentsRes.rows[0].count}`);
    console.log(`- SELECT count(*) FROM internships;     => ${internshipsRes.rows[0].count}`);
    console.log(`- SELECT count(*) FROM recommendations; => ${recsRes.rows[0].count}`);
    console.log(`- SELECT count(*) FROM interactions;    => ${intersRes.rows[0].count}`);
  } catch (err: any) {
    console.error("Query failed:", err.message);
  } finally {
    await pool.end();
  }
}

queryCounts();
