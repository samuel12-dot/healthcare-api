import { ProblemError } from "./problem";

export interface Cursor {
  createdAt: string;
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(raw: string): Cursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Cursor).createdAt !== "string" ||
      typeof (parsed as Cursor).id !== "string"
    ) {
      throw new Error("malformed cursor");
    }
    return parsed as Cursor;
  } catch {
    throw ProblemError.badRequest("Invalid pagination cursor");
  }
}
