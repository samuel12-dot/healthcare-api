import type { Request, Response, NextFunction } from "express";

/** RFC 7807 application/problem+json error. */
export class ProblemError extends Error {
  status: number;
  type: string;
  title: string;
  detail?: string;
  extra?: Record<string, unknown>;

  constructor(
    status: number,
    title: string,
    detail?: string,
    type = "about:blank",
    extra?: Record<string, unknown>,
  ) {
    super(detail ?? title);
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.type = type;
    this.extra = extra;
  }

  static badRequest(detail?: string, extra?: Record<string, unknown>) {
    return new ProblemError(400, "Bad Request", detail, "https://httpstatuses.com/400", extra);
  }
  static unauthorized(detail?: string) {
    return new ProblemError(401, "Unauthorized", detail, "https://httpstatuses.com/401");
  }
  static forbidden(detail?: string) {
    return new ProblemError(403, "Forbidden", detail, "https://httpstatuses.com/403");
  }
  static notFound(detail?: string) {
    return new ProblemError(404, "Not Found", detail, "https://httpstatuses.com/404");
  }
  static conflict(detail?: string, extra?: Record<string, unknown>) {
    return new ProblemError(409, "Conflict", detail, "https://httpstatuses.com/409", extra);
  }
  static unprocessable(detail?: string, extra?: Record<string, unknown>) {
    return new ProblemError(422, "Unprocessable Entity", detail, "https://httpstatuses.com/422", extra);
  }
  static tooManyRequests(detail?: string) {
    return new ProblemError(429, "Too Many Requests", detail, "https://httpstatuses.com/429");
  }
  static internal(detail?: string) {
    return new ProblemError(500, "Internal Server Error", detail, "https://httpstatuses.com/500");
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).type("application/problem+json").json({
    type: "https://httpstatuses.com/404",
    title: "Not Found",
    status: 404,
    detail: `No route for ${req.method} ${req.path}`,
    instance: req.path,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req as Request & { id?: string }).id;

  if (err instanceof ProblemError) {
    res.status(err.status).type("application/problem+json").json({
      type: err.type,
      title: err.title,
      status: err.status,
      detail: err.detail,
      instance: req.path,
      requestId,
      ...(err.extra ?? {}),
    });
    return;
  }

  req.log?.error({ err }, "unhandled error");
  res.status(500).type("application/problem+json").json({
    type: "https://httpstatuses.com/500",
    title: "Internal Server Error",
    status: 500,
    detail: "An unexpected error occurred",
    instance: req.path,
    requestId,
  });
}
