import path from "path";
import fs from "fs";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

function initEnv() {
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
initEnv();

const dbUrl = process.env.DATABASE_URL || "pglite://memory";

let dbInstance: any;
let poolInstance: any = null;
let pgliteInstance: any = null;

if (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://")) {
  console.log("[@workspace/db] Initializing Drizzle with PostgreSQL Pooler:", dbUrl.substring(0, 35) + "...");
  poolInstance = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  dbInstance = drizzlePg(poolInstance, { schema });
} else {
  console.log("[@workspace/db] Initializing Drizzle with in-memory PGlite WASM");
  pgliteInstance = new PGlite();
  dbInstance = drizzlePglite(pgliteInstance, { schema });
}

export const pool = poolInstance;
export const pglite = pgliteInstance;
export const db = dbInstance;

let initPromise: Promise<void> | null = null;

export async function ensureTables() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const ddl = `
        DO $$ BEGIN
          CREATE TYPE action AS ENUM ('view', 'save', 'skip', 'apply', 'like');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;

        CREATE TABLE IF NOT EXISTS students (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          degree TEXT NOT NULL,
          year TEXT NOT NULL,
          career_goal TEXT NOT NULL,
          location TEXT NOT NULL,
          work_mode TEXT NOT NULL,
          stipend_preference TEXT NOT NULL,
          interests TEXT[],
          skills JSONB
        );

        CREATE TABLE IF NOT EXISTS internships (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          company TEXT NOT NULL,
          description TEXT NOT NULL,
          domain TEXT NOT NULL,
          location TEXT NOT NULL,
          work_mode TEXT NOT NULL,
          duration TEXT NOT NULL,
          stipend TEXT NOT NULL,
          education TEXT,
          required_skills TEXT[] NOT NULL,
          preferred_skills TEXT[] NOT NULL,
          experience_level TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS interactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          internship_id UUID NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
          action action NOT NULL,
          reason TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS recommendations (
          student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          internship_id UUID NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
          score NUMERIC NOT NULL,
          reasons JSONB,
          skill_gap JSONB,
          PRIMARY KEY (student_id, internship_id)
        );
      `;

      if (pgliteInstance) {
        await pgliteInstance.exec(ddl);
      } else if (poolInstance) {
        await poolInstance.query(ddl);
      }
    } catch (err) {
      console.error("Error creating database tables DDL:", err);
    }
  })();

  return initPromise;
}

export * from "./schema";
