import crypto from "node:crypto";
import QRCode from "qrcode";
import { generateSecret, generate, verify } from "otplib";
import { env } from "../config/env";

const ALGORITHM = "sha1" as const;
const DIGITS = 6 as const;
const PERIOD = 30;

function encryptionKey(): Buffer {
  if (env.totpEncryptionKey) {
    const key = Buffer.from(env.totpEncryptionKey, "base64");
    if (key.length !== 32) {
      throw new Error("TOTP_ENCRYPTION_KEY must decode to exactly 32 bytes.");
    }
    return key;
  }
  // Development-only fallback. Production startup refuses to run without the
  // env var (see config/env.ts), so a real deployment can never use this.
  return crypto.createHash("sha256").update(`emc-dev-totp:${env.jwtSecret}`).digest();
}

/** Cryptographically secure RFC 6238 Base32 secret. */
export function generateTotpSecret(): string {
  return generateSecret({ length: 20 });
}

/** Standard otpauth:// provisioning URI understood by all major authenticator apps. */
export function buildTotpUri(email: string, secret: string): string {
  const issuer = env.totpIssuer;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD),
  });
  return `otpauth://totp/${encodeURI(`${issuer}:${email}`)}?${params.toString()}`;
}

/** AES-256-GCM authenticated encryption for secrets stored at rest. */
export function encryptTotpSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${ciphertext.toString("base64")}`;
}

/** Returns null on any malformed/tampered value. Never throws to callers. */
export function decryptTotpSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    const [version, ivPart, tagPart, dataPart] = stored.split(".");
    if (version !== "v1" || !ivPart || !tagPart || !dataPart) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64"));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(dataPart, "base64")), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    return null;
  }
}

export interface TotpVerification {
  valid: boolean;
  /** RFC 6238 time step that matched; used for replay protection. */
  step?: number;
}

/**
 * Verifies a 6-digit code against an RFC 6238 (SHA-1 / 6 digits / 30s) secret.
 * `afterTimeStep` rejects any code from the last accepted step or earlier.
 */
export async function verifyTotpCode(
  code: string,
  secret: string,
  afterTimeStep?: number | null,
): Promise<TotpVerification> {
  if (!/^\d{6}$/.test(code)) return { valid: false };
  try {
    const result = await verify({
      secret,
      token: code,
      algorithm: ALGORITHM,
      digits: DIGITS,
      period: PERIOD,
      epochTolerance: env.totpWindowSeconds,
      ...(afterTimeStep != null && Number.isFinite(afterTimeStep) ? { afterTimeStep } : {}),
    });
    if (!result.valid) return { valid: false };
    // otplib's functional verify result is typed as a union of HOTP/TOTP
    // variants; the TOTP strategy always supplies `timeStep` at runtime.
    const step = "timeStep" in result ? (result as { timeStep?: number }).timeStep : undefined;
    return typeof step === "number" ? { valid: true, step } : { valid: false };
  } catch {
    // Out-of-range afterTimeStep or malformed secret must fail closed.
    return { valid: false };
  }
}

/** Generates a code for tests / interoperability checks only. Never exposed by an API. */
export function generateTotpCodeForTest(secret: string, epochSeconds?: number): Promise<string> {
  return generate({
    secret,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
    ...(epochSeconds !== undefined ? { epoch: epochSeconds } : {}),
  });
}

export function currentTotpStep(epochMs = Date.now()): number {
  return Math.floor(epochMs / 1000 / PERIOD);
}

export async function qrDataUrl(uri: string): Promise<string> {
  return QRCode.toDataURL(uri, { errorCorrectionLevel: "M", margin: 1, width: 256 });
}
