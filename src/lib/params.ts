import type { Request } from "express";

/**
 * Route params are only reached here after the `validate(schema, "params")`
 * middleware has run, so presence is already guaranteed by Zod -- this just
 * narrows the type past `noUncheckedIndexedAccess` without re-checking.
 */
export function param(req: Request, name: string): string {
  return req.params[name] as string;
}
