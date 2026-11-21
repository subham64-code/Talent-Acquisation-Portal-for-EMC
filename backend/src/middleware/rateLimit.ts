import rateLimitPkg from "express-rate-limit";
import { env } from "../config/env";

// express-rate-limit v7 exposes a default export, v8 a named `rateLimit`.
const rateLimit = ((rateLimitPkg as any).rateLimit ?? rateLimitPkg) as (opts: any) => any;

/**
 * Rate limiter for the API.
 *
 * Limits are enforced per client IP using the in-memory store, which is enough
 * for a single Node process. Behind a load balancer the same behaviour can be
 * moved to a shared store without touching the route definitions.
 */
function build(windowMinutes: number, limit: number, message: string) {
  return {
    windowMs: windowMinutes * 60 * 1000,
    limit,
    max: limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: any) => {
      const ip = String(req.ip || req.socket?.remoteAddress || "unknown").trim();
      return `emc:ratelimit:${ip}`;
    },
    message: { success: false, error: { code: "TOO_MANY_REQUESTS", message } },
  };
}

export const globalRateLimiter = rateLimit(
  build(env.rateLimitWindowMinutes, env.rateLimitMax, "Too many requests, please try again later."),
);

/** Public career endpoints: read-heavy browsing plus the expensive CV-upload write. */
export const publicRateLimiter = rateLimit(
  build(env.rateLimitWindowMinutes, env.rateLimitMax, "Too many requests, please try again later."),
);

/** Stricter limit for the public application submission (CV scan + email side effects). */
export const applicationRateLimiter = rateLimit(
  build(env.rateLimitWindowMinutes, 20, "Too many applications submitted. Please try again later."),
);

export const authRateLimiter = rateLimit(
  build(env.rateLimitWindowMinutes, env.authRateLimitMax, "Too many authentication attempts, please try again later."),
);

/** Tighter per-IP limiter for TOTP verification and enrollment endpoints. */
export const totpRateLimiter = rateLimit(
  build(env.rateLimitWindowMinutes, 10, "Too many authenticator attempts. Please try again later."),
);
