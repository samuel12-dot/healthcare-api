import { PrismaClient } from "@prisma/client";

// "test" is quiet by default: expected constraint-violation errors (e.g. the
// appointments concurrency test) are asserted on directly, not worth the noise.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : process.env.NODE_ENV === "test" ? [] : ["error"],
});
