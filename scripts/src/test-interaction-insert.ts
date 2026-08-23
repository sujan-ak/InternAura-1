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
      try {
        process.loadEnvFile(file);
      } catch {}
      break;
    }
  }
}
loadEnv();

import app from "../../artifacts/api-server/src/app";
import http from "http";

async function testInteractionAndProfile() {
  console.log("=================================================");
  console.log("  TESTING INTERACTION LOGGING & PROFILE CREATION  ");
  console.log("=================================================");

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(5003, resolve));

  // 1. Post a view interaction via API server
  console.log("\nPosting POST /api/interactions (action='view')...");
  const interactionRes = await fetch("http://localhost:5003/api/interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId: "00000000-0000-0000-0000-000000000001",
      internshipId: "10000000-0000-0000-0000-000000000001",
      action: "view",
      reason: null,
    }),
  });
  console.log("POST /api/interactions status:", interactionRes.status);
  const interactionJson = await interactionRes.json();
  console.log("POST /api/interactions response:", interactionJson);

  // 2. Query direct Supabase PostgreSQL database for interactions
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const interRows = await pool.query(
      "SELECT * FROM interactions ORDER BY created_at DESC LIMIT 5"
    );
    console.log("\n-------------------------------------------------");
    console.log("QUERY: SELECT * FROM interactions ORDER BY created_at DESC LIMIT 5;");
    console.log("-------------------------------------------------");
    console.log(JSON.stringify(interRows.rows, null, 2));

    const studentRows = await pool.query("SELECT * FROM students");
    console.log("\n-------------------------------------------------");
    console.log("QUERY: SELECT * FROM students;");
    console.log("-------------------------------------------------");
    console.log(JSON.stringify(studentRows.rows, null, 2));
  } catch (err: any) {
    console.error("Direct Query Error:", err);
  } finally {
    await pool.end();
    server.close();
  }
}

testInteractionAndProfile();
