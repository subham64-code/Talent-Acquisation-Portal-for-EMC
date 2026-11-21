import { PrismaClient } from "@prisma/client";
import { PrismaNeon, PrismaNeonHTTP } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { env } from "../config/env";

/**
 * How Prisma reaches Neon. The transport is picked so the backend keeps working
 * on any network:
 * - "tcp": Prisma's native engine over TCP 5432. Fastest, full transaction support.
 * - "ws": Neon serverless driver over WebSocket (TLS 443). Needed on serverless
 *   hosts where long-lived TCP connections are not viable.
 * - "http": Neon HTTP driver (TLS 443 fetch). Last resort on networks that only
 *   allow plain HTTPS. Does not support transactions, so write paths avoid them.
 *
 * DB_TRANSPORT=auto (default) probes tcp -> ws -> http at startup and keeps the
 * first transport that answers. Set DB_TRANSPORT explicitly to skip probing.
 */
export type DbTransport = "tcp" | "ws" | "http";

const requested = (env.dbTransport || "auto").toLowerCase();
const initialTransport: DbTransport = requested === "ws" || requested === "http" ? requested : "tcp";
const autoSelect = requested !== "ws" && requested !== "http" && requested !== "tcp";

neonConfig.webSocketConstructor = ws;

const logOptions = env.isDev ? ["warn", "error"] : ["error"];

function createBaseClient(transport: DbTransport): PrismaClient {
  if (!env.databaseUrl) {
    return new PrismaClient({ log: logOptions as any });
  }
  if (transport === "ws") {
    return new PrismaClient({
      adapter: new PrismaNeon({ connectionString: env.databaseUrl }, { schema: "emc_talent" }),
      log: logOptions as any,
    });
  }
  if (transport === "http") {
    return new PrismaClient({
      adapter: new PrismaNeonHTTP(env.databaseUrl, { arrayMode: true, fullResults: true }),
      log: logOptions as any,
    });
  }
  return new PrismaClient({
    datasources: { db: { url: env.databaseUrl } },
    log: logOptions as any,
  });
}

/**
 * Neon's serverless WebSocket pool can drop an idle socket (reported as
 * "socket hang up"). The pooled query then fails before it reaches Postgres,
 * so a short retry on the next socket is safe and keeps requests reliable.
 */
const TRANSIENT_DB_ERRORS = [
  "socket hang up",
  "econnreset",
  "econnrefused",
  "etimedout",
  "epipe",
  "connection terminated",
  "connection closed",
  "websocket",
  "p1001",
  "p1017",
  "p2024",
];

function isTransientDbError(error: unknown): boolean {
  const err = error as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  const code = String(err?.code ?? err?.cause?.code ?? "").toLowerCase();
  if (code && TRANSIENT_DB_ERRORS.includes(code)) return true;
  const message = `${err?.message ?? ""} ${err?.cause?.message ?? ""}`.toLowerCase();
  return TRANSIENT_DB_ERRORS.some((needle) => message.includes(needle));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Only idempotent reads may be retried. Re-running a write after a dropped
// connection can duplicate notifications, audit rows or status history if the
// first attempt actually committed before the response was lost.
const READ_OPERATIONS = new Set([
  "findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany",
  "count", "aggregate", "groupBy", "$queryRaw",
]);

function createClient(transport: DbTransport) {
  return createBaseClient(transport).$extends({
    name: "retry-transient-connections",
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          const retryable = READ_OPERATIONS.has(operation);
          let lastError: unknown;
          for (let attempt = 0; attempt < (retryable ? 3 : 1); attempt++) {
            try {
              return await query(args);
            } catch (error) {
              if (!retryable || !isTransientDbError(error) || attempt === 2) throw error;
              lastError = error;
              await sleep(200 * (attempt + 1));
            }
          }
          throw lastError;
        },
      },
    },
  });
}

type EmcPrismaClient = ReturnType<typeof createClient>;

export let prisma: EmcPrismaClient = createClient(initialTransport);

let activeTransport: DbTransport = initialTransport;

function describeError(error: unknown): string {
  const err = error as { message?: string; cause?: { message?: string } };
  const message = err?.message || err?.cause?.message || String(error);
  return message.split("\n")[0].slice(0, 160);
}

async function probe(client: EmcPrismaClient, timeoutMs = 8_000): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  try {
    const result = await Promise.race([
      client.$queryRaw`SELECT 1`.then(() => true).catch((error) => {
        console.warn(`[db] probe failed: ${describeError(error)}`);
        return false;
      }),
      timeout,
    ]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Resolves the working DB transport once at startup. With DB_TRANSPORT=auto it
 * tries tcp, then ws, then http so a deployment survives firewall setups that
 * block any single transport.
 */
export async function ensureDatabaseTransport(): Promise<DbTransport> {
  if (!autoSelect) {
    console.log(`[db] transport=${activeTransport}`);
    return activeTransport;
  }

  if (await probe(prisma)) {
    activeTransport = initialTransport;
    console.log(`[db] transport=${activeTransport}`);
    return activeTransport;
  }

  await prisma.$disconnect().catch(() => undefined);

  for (const transport of ["ws", "http"] as const) {
    if (transport === initialTransport) continue;
    const candidate = createClient(transport);
    if (await probe(candidate)) {
      prisma = candidate;
      activeTransport = transport;
      console.log(`[db] transport=${transport}`);
      return transport;
    }
    await candidate.$disconnect().catch(() => undefined);
  }

  // Nothing answered; keep tcp so the app recovers when the network returns.
  prisma = createClient("tcp");
  activeTransport = "tcp";
  console.warn("[db] no transport reachable yet; defaulting to tcp and retrying per request");
  return activeTransport;
}

/**
 * A network change (e.g. moving Wi-Fi) can blackhole the Neon TCP port while
 * HTTPS/WSS still works. With DB_TRANSPORT=auto, re-check periodically and move
 * to a working transport so long-running processes recover without a restart.
 */
const RECHECK_INTERVAL_MS = 60_000;
let recheckTimer: ReturnType<typeof setInterval> | undefined;

async function recheckTransport(): Promise<void> {
  if (await probe(prisma, 5_000)) return;
  await prisma.$disconnect().catch(() => undefined);
  for (const transport of ["ws", "http", "tcp"] as const) {
    if (transport === activeTransport) continue;
    const candidate = createClient(transport);
    if (await probe(candidate, 5_000)) {
      prisma = candidate;
      activeTransport = transport;
      console.log(`[db] network changed — switched transport=${transport}`);
      return;
    }
    await candidate.$disconnect().catch(() => undefined);
  }
  console.warn("[db] no transport reachable during recheck; keeping current one");
}

function startTransportWatchdog(): void {
  if (!autoSelect || recheckTimer) return;
  recheckTimer = setInterval(() => { void recheckTransport(); }, RECHECK_INTERVAL_MS);
  recheckTimer.unref();
}

startTransportWatchdog();

export function currentDbTransport(): DbTransport {
  return activeTransport;
}
