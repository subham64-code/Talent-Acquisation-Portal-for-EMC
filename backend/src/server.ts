import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import fs from "node:fs";
import path from "node:path";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { globalRateLimiter, authRateLimiter } from "./middleware/rateLimit";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { swaggerDocument } from "./docs/swagger";
import swaggerUi from "swagger-ui-express";

import authRoutes from "./modules/auth";
import usersRoutes from "./modules/users";
import departmentsRoutes from "./modules/departments";
import designationsRoutes from "./modules/designations";
import programsRoutes from "./modules/programs";
import employmentTypesRoutes from "./modules/employmentTypes";
import employeesRoutes from "./modules/employees";
import employeeInvitationsRoutes from "./modules/employeeInvitations";
import candidatesRoutes from "./modules/candidates";
import openingsRoutes from "./modules/openings";
import applicationsRoutes from "./modules/applications";
import aiScreeningRoutes from "./modules/aiScreening";
import interviewsRoutes from "./modules/interviews";
import offersRoutes from "./modules/offers";
import documentsRoutes from "./modules/documents";
import dashboardRoutes from "./modules/dashboard";
import reportsRoutes from "./modules/reports";
import notificationsRoutes from "./modules/notifications";
import settingsRoutes from "./modules/settings";
import filesRoutes from "./modules/files";
import publicRoutes from "./modules/public";

import { startEmployeeInvitationReminderScheduler } from "./services/invitationReminderService";

const app = express();

app.set("trust proxy", 1);
// CSP mirrors helmet defaults minus upgrade-insecure-requests so the built
// portal also works when served over plain HTTP on a LAN (no TLS terminator).
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "https:", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
    },
  },
}));
app.use(cors({ origin: env.corsOrigins, credentials: true, methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization"] }));
app.use(compression());
morgan.token("safe-url", (req: any) => String(req?.originalUrl ?? "")
  .replace(/(invitation|files|documents\/upload|portal)\/[^?&]+/g, "$1/[redacted]")
  .replace(/([?&](?:token|code)=)[^&]+/g, "$1[redacted]"));
app.use(morgan(":method :safe-url :status :res[content-length] - :response-time ms"));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/api/v1/health", (_req, res) => res.json({ status: "ok", service: env.appName, time: new Date().toISOString() }));

if (env.isDev) {
  app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.get("/api/v1/openapi.json", (_req, res) => res.json(swaggerDocument));
}

// Public career portal + authentication routes (self-contained prefixes)
app.use("/api/v1", publicRoutes);
app.use("/api/v1", authRoutes);
// HR user management (self-contained /users prefix)
app.use("/api/v1", usersRoutes);
// Resource modules (routes are relative to their namespace)
app.use("/api/v1/departments", departmentsRoutes);
app.use("/api/v1/designations", designationsRoutes);
app.use("/api/v1/programs", programsRoutes);
app.use("/api/v1/employment-types", employmentTypesRoutes);
app.use("/api/v1/employees", employeesRoutes);
app.use("/api/v1/candidates", candidatesRoutes);
app.use("/api/v1/openings", openingsRoutes);
app.use("/api/v1/applications", applicationsRoutes);
app.use("/api/v1/ai-screening", aiScreeningRoutes);
app.use("/api/v1/interviews", interviewsRoutes);
app.use("/api/v1/offers", offersRoutes);
app.use("/api/v1/documents", documentsRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/reports", reportsRoutes);
app.use("/api/v1/notifications", notificationsRoutes);
app.use("/api/v1/settings", settingsRoutes);
app.use("/api/v1/files", filesRoutes);
// HR self-service databank APIs (protected) are mounted last so they do not
// intercept public career/offer/document endpoints mounted before them.
app.use("/api/v1", employeeInvitationsRoutes);

// Serve the built frontend (when present) with SPA fallback so deep links such
// as /employee/update?token=... work directly from invitation emails.
const distCandidates = [
  process.env.FRONTEND_DIST,
  path.resolve(__dirname, "../../frontend/dist"),
  path.resolve(process.cwd(), "frontend/dist"),
  path.resolve(process.cwd(), "../frontend/dist"),
].filter((p): p is string => Boolean(p));
const distDir = distCandidates.find((dir) => fs.existsSync(path.join(dir, "index.html")));
if (distDir) {
  app.use("/assets", express.static(path.join(distDir, "assets"), { immutable: true, maxAge: "365d", fallthrough: true }));
  app.use(express.static(distDir, { index: false, maxAge: "1h" }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`[${env.appName}] backend listening on http://localhost:${env.port}`);
  console.log(`[email] SMTP configured=${Boolean(env.smtpHost && env.smtpUser && env.smtpPass)} host=${env.smtpHost} user=${env.smtpUser}`);
  startEmployeeInvitationReminderScheduler();
  if (env.isDev && require("./integrations/email/email.service").emailSimulated()) {
    console.log("[email] Emails will be simulated if transporter fails.");
  }

  // Warm the connection pool immediately so the very first request is fast�
  prisma.$queryRaw`SELECT 1`.catch((err) => console.error("[db] warm-up failed:", String(err?.message ?? err).split("\n")[0]));
  // �and keep it warm. Neon suspends idle compute after ~5 minutes; a light
  // ping every 4 minutes prevents costly cold starts for the next request.
  const keepAlive = setInterval(() => {
    prisma.$queryRaw`SELECT 1`.catch(() => undefined);
  }, 4 * 60 * 1000);
  keepAlive.unref();
});
