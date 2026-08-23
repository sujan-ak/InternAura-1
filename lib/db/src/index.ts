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

export * from "./schema";
export * from "./hybrid-scorer";
export * from "./skill-normalizer";
