/**
 * Fail-fast environment validation.
 * PLACE AT: artifacts/api-server/src/lib/env.ts
 *
 * Env vars were previously read ad hoc via `process.env.X` across routes, so a
 * missing GROQ_API_KEY silently degraded to fallback questions and a missing
 * HUGGINGFACE_API_KEY silently degraded to a character hash — with no signal
 * anywhere that the "AI" features were off. This surfaces it at boot.
 */

import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  LOG_LEVEL: z.string().default("info"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_JWT_SECRET: z.string().optional(),

  // Optional integrations — absent means degraded, not broken.
  GROQ_API_KEY: z.string().optional(),
  // The old code hardcoded "groq/compound", which server.log shows returning
  // HTTP 413 and 429. Make it configurable so it can be changed without a deploy.
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  HUGGINGFACE_API_KEY: z.string().optional(),
  ADZUNA_APP_ID: z.string().optional(),
  ADZUNA_APP_KEY: z.string().optional(),

  CORS_ALLOWED_ORIGINS: z.string().default(""),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;

export const corsOrigins: string[] = env.CORS_ALLOWED_ORIGINS.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Log which optional capabilities are actually live, once, at boot. */
export function logCapabilities(log: { info: (o: object, m: string) => void }): void {
  log.info(
    {
      aiQuestionGeneration: Boolean(env.GROQ_API_KEY),
      semanticEmbeddings: env.HUGGINGFACE_API_KEY ? "MiniLM" : "lexical-hash-fallback",
      liveJobs: Boolean(env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY),
    },
    "Optional capabilities",
  );
}
