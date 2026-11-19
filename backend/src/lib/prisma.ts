import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { env } from "../config/env";

// Neon uses WebSocket transport over TLS port 443, which is reachable and
// supports the transactions required by the auth and invitation flows.
neonConfig.webSocketConstructor = ws;

declare global {
  // eslint-disable-next-line no-var
  var __emcPrisma: PrismaClient | undefined;
}

const adapter = env.databaseUrl ? new PrismaNeon({ connectionString: env.databaseUrl }, { schema: "emc_talent" }) : undefined;

export const prisma =
  global.__emcPrisma ??
  (adapter
    ? new PrismaClient({ adapter, log: env.isDev ? ["warn", "error"] : ["error"] })
    : new PrismaClient({ log: env.isDev ? ["warn", "error"] : ["error"], datasources: env.databaseUrl ? { db: { url: env.databaseUrl } } : undefined }));

if (env.isDev) {
  global.__emcPrisma = prisma;
}
