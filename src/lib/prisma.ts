import { Prisma, PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// SQL query text may contain personal room/widget metadata or email values.
// Production never enables raw query logging. Local development requires an
// explicit, separate opt-in, and logs should not be shared publicly.
const prismaLog: Prisma.LogLevel[] =
  process.env.NODE_ENV === "development" && process.env.CUBICS_DEBUG_SQL === "true"
    ? ["query", "error"]
    : ["error"];

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: prismaLog,
  });

if (process.env.NODE_ENV !== "production") global.prisma = prisma;
