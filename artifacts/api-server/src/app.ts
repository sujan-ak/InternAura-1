/**
 * Express app — HARDENED
 * REPLACES: artifacts/api-server/src/app.ts
 *
 * The original was 30 lines: pino, cors(), json, router. Missing entirely:
 * helmet, a CORS allowlist, a body-size limit, rate limiting, and any error
 * handler — so every route repeated the same try/catch/console.error block and
 * unhandled rejections fell through to Express 5's default handler, which leaks
 * stack traces outside production.
 *
 * INSTALL: pnpm --filter @workspace/api-server add helmet express-rate-limit jose
 * REMOVE:  cookie-parser (declared in package.json, never imported)
 */

import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { corsOrigins, env } from "./lib/env";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler";

const app: Express = express();

// Behind Replit's router, so client IPs arrive via X-Forwarded-For. Without this
// express-rate-limit buckets every request under the proxy's single IP.
app.set("trust proxy", 1);

app.use(helmet());

app.use(
  cors({
    // FIX: cors() with no options allowed every origin. Native builds send no
    // Origin header at all, so `!origin` must pass for the Expo app to work.
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (corsOrigins.length === 0 && env.NODE_ENV !== "production") {
        return callback(null, true);
      }
      if (corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url?.split("?")[0] }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }),
);

// Cap JSON bodies. /assessment/sessions/:id/submit posts only an answers map now
// that questions no longer round-trip, so 256kb is generous.
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

const readLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

// Tight bucket for the expensive paths: pdf-parse is CPU-bound and the Groq /
// Adzuna calls cost money. Previously all three were unmetered AND unauthenticated.
const expensiveLimiter = rateLimit({
  windowMs: 60_000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests — please wait a minute and try again." },
});

app.use("/api/resume", expensiveLimiter);
app.use("/api/assessment", expensiveLimiter);
app.use("/api/internships/search-adzuna", expensiveLimiter);
app.use("/api", readLimiter);

app.use("/api", router);

app.use(notFoundHandler);
app.use(errorHandler); // must be last

export default app;
