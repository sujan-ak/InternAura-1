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

async function confirmAllAuthUsers() {
  try {
    console.log("Auto-confirming email addresses for all auth.users in Supabase PostgreSQL...");

    const updateRes = await pool.query(`
      UPDATE auth.users 
      SET email_confirmed_at = NOW()
      WHERE email_confirmed_at IS NULL
      RETURNING id, email, email_confirmed_at;
    `);

    console.log("Auto-confirmed auth.users:", updateRes.rows);
  } catch (err: any) {
    console.error("Error updating auth.users:", err.message);
  } finally {
    process.exit(0);
  }
}

confirmAllAuthUsers();
