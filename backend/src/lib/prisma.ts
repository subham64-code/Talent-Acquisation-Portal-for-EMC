import { PrismaClient } from "@prisma/client";
import { env } from "../config/env";

declare global {
  // eslint-disable-next-line no-var
  var __emcPrisma: PrismaClient | undefined;
}

export const prisma =
  global.__emcPrisma ??
  new PrismaClient({
    log: env.isDev ? ["warn", "error"] : ["error"],
    datasources: env.databaseUrl ? { db: { url: env.databaseUrl } } : undefined,
  });

if (env.isDev) {
  global.__emcPrisma = prisma;
}
