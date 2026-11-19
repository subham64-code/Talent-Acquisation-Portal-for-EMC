import crypto from "node:crypto";

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function sha256(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(secret, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifySecret(secret: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(secret, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  if (expected.length !== derived.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function generateOtp(digits = 6): string {
  const max = 10 ** digits;
  return String(crypto.randomInt(0, max)).padStart(digits, "0");
}

export function safeFileName(name: string): string {
  const base = name.replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-");
  return base.slice(-120) || "file";
}

export function codeFromName(name: string, prefix = ""): string {
  const initials = name
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]?.toUpperCase())
    .join("")
    .slice(0, 4);
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  return `${prefix}${initials || "X"}${stamp}`;
}

/** Auto-generated temporary password emailed on HR account creation. No ambiguous characters. */
export function generateHrPassword(length = 10): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i] % alphabet.length];
  if (!/[A-Za-z]/.test(out) || !/[0-9]/.test(out)) return generateHrPassword(length);
  return out;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, expectedHex] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !expectedHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  if (expected.length !== derived.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function passwordStrengthError(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters long.";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain both letters and numbers.";
  }
  return null;
}

export function contentDispositionFilename(name: string, disposition: "inline" | "attachment" = "attachment"): string {
  const ascii = name.normalize("NFKD").replace(/[\x00-\x1f\x7f"\\]/g, "_").replace(/[^\x20-\x7e]/g, "_").slice(-140) || "file";
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name.normalize("NFKD").replace(/[\r\n]/g, "_"))}`;
}
