/**
 * Single error handler — replaces the repeated try/catch + console.error blocks
 * in all 9 route files.
 * PLACE AT: artifacts/api-server/src/middlewares/error-handler.ts
 *
 * Also fixes a leak: routes logged with bare `console.error`, which bypasses the
 * redaction rules configured on the pino logger in lib/logger.ts.
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import { logger } from "../lib/logger";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Wrap async handlers so rejections reach the error handler instead of hanging. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) return;

  if (err instanceof HttpError) {
    logger.warn({ err, path: req.path, status: err.status }, "Request failed");
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }

  logger.error({ err, path: req.path }, "Unhandled error");

  const rawMsg = String((err as Error)?.message ?? err);
  const isDbOrQueryError = /failed query|syntax error|relation|constraint|column|pg_/i.test(rawMsg);
  const sanitizedMsg = isDbOrQueryError ? "An internal database error occurred. Please try again." : rawMsg;

  const isProd = process.env.NODE_ENV === "production";
  res.status(500).json({
    error: isProd ? "Internal server error" : sanitizedMsg,
  });
}
