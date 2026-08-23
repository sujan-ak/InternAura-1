/**
 * Supabase JWT verification — fixes gap #8.
 *
 * PLACE AT: artifacts/api-server/src/middlewares/auth.ts
 * INSTALL:  pnpm --filter @workspace/api-server add jose
 *
 * THE BUG THIS FIXES
 * ------------------
 * There was no auth middleware at all. Every route improvised its own answer to
 * "which student is this?" from query params or the body, and three of them fell
 * back to the seeded demo user. Net effect: anyone could read or overwrite any
 * profile, and GET /students/me with no params returned whatever row happened to
 * be first in the table.
 *
 * The client half already exists and was never called:
 *   lib/api-client-react/src/custom-fetch.ts -> setAuthTokenGetter()
 * See patches/app/lib/api.ts for the wiring.
 *
 * AFTER MOUNTING THIS: delete every student_id / authUser query param used for
 * IDENTITY. req.student is the only source of truth.
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { db, studentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

export interface AuthedStudent {
  id: string;
  authUserId: string;
  name: string;
  skills: string[];
}

declare global {
  namespace Express {
    interface Request {
      authUserId?: string;
      student?: AuthedStudent;
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) throw new Error("SUPABASE_URL is required for JWT verification");

// Supabase publishes asymmetric signing keys here; createRemoteJWKSet caches
// and handles rotation automatically.
const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));

// HS256 fallback for projects still on the shared legacy JWT secret.
const LEGACY_SECRET = process.env.SUPABASE_JWT_SECRET
  ? new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET)
  : null;

async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: `${SUPABASE_URL}/auth/v1` });
    return payload;
  } catch {
    if (!LEGACY_SECRET) return null;
    try {
      const { payload } = await jwtVerify(token, LEGACY_SECRET);
      return payload;
    } catch {
      return null;
    }
  }
}

function bearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Verifies the JWT and resolves it to exactly one student row.
 * 401 = no/bad token.
 * 404 + code NO_PROFILE = valid token, no profile yet. The client routes to
 * onboarding — it does NOT get handed somebody else's row.
 */
export const requireAuth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = bearer(req);
  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  const payload = await verifyToken(token);
  if (!payload?.sub) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  req.authUserId = payload.sub;

  try {
    const rows = await db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.authUser, payload.sub))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: "No student profile for this account", code: "NO_PROFILE" });
      return;
    }

    const row = rows[0];
    req.student = {
      id: row.id,
      authUserId: payload.sub,
      name: row.name,
      skills: Array.isArray(row.skills) ? (row.skills as string[]) : [],
    };
    next();
  } catch (err) {
    logger.error({ err }, "Failed to resolve student from token");
    res.status(500).json({ error: "Auth resolution failed" });
  }
};

/**
 * Authenticates but tolerates a missing profile — for POST /students, which is
 * how a profile gets created in the first place.
 */
export const requireAuthUserOnly: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = bearer(req);
  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const payload = await verifyToken(token);
  if (!payload?.sub) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  req.authUserId = payload.sub;
  next();
};
