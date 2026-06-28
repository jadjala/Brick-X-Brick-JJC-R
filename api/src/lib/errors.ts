import type { NextFunction, Request, Response, RequestHandler } from 'express';

// SPEC §11 error envelope. Endpoints in Sprint 1 throw AppError; the handler
// below renders the exact shape. Wired up now so the contract is fixed early.
export type ErrorCode =
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'DUPLICATE'
  | 'INVALID_STATE'
  | 'INVALID_INPUT'
  | 'OUT_OF_WINDOW'
  | 'INTERNAL';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  INVALID_INPUT: 400, // also 422 for semantic failures — pass status explicitly
  AUTH_REQUIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  DUPLICATE: 409,
  INVALID_STATE: 409,
  OUT_OF_WINDOW: 422,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown, status?: number) {
    super(message);
    this.code = code;
    this.status = status ?? STATUS_BY_CODE[code];
    this.details = details;
  }
}

/** Wrap async route handlers so thrown/rejected errors reach the error handler. */
export const asyncHandler =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Resource not found.' },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }
  // Unexpected: log server-side, return a generic envelope (SPEC §11 INTERNAL).
  console.error('[error]', err);
  res.status(500).json({
    error: { code: 'INTERNAL', message: 'An unexpected error occurred.' },
  });
}
