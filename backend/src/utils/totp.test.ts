import { describe, expect, it } from "vitest";
import {
  buildTotpUri,
  currentTotpStep,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpCodeForTest,
  generateTotpSecret,
  verifyTotpCode,
} from "./totp";

// RFC 6238 Appendix B test secret ("12345678901234567890") in Base32.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const RFC_VECTORS: Array<[number, string]> = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
];

describe("TOTP primitives (RFC 6238, SHA-1 / 6 digits / 30s)", () => {
  it("matches the RFC 6238 published test vectors (6-digit truncation)", async () => {
    for (const [epoch, expected8] of RFC_VECTORS) {
      const code = await generateTotpCodeForTest(RFC_SECRET, epoch);
      expect(code).toBe(expected8.slice(-6));
    }
  });

  it("generates cryptographically random Base32 secrets of sufficient length", () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Z2-7]{16,}$/);
    expect(Buffer.byteLength(a, "utf8")).toBeGreaterThanOrEqual(16);
  });

  it("builds a standard otpauth:// provisioning URI", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const uri = buildTotpUri("hr@example.com", secret);
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=Ecometrix");
    expect(uri).toContain("algorithm=SHA1");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });

  it("accepts a code generated in the current step", async () => {
    const secret = generateTotpSecret();
    const code = await generateTotpCodeForTest(secret);
    const result = await verifyTotpCode(code, secret);
    expect(result.valid).toBe(true);
    expect(typeof result.step).toBe("number");
  });

  it("rejects an invalid code", async () => {
    const secret = generateTotpSecret();
    const result = await verifyTotpCode("000000", secret);
    expect(result.valid).toBe(false);
  });

  it("rejects an expired code outside the configured drift window", async () => {
    const secret = generateTotpSecret();
    const step = currentTotpStep();
    const expired = await generateTotpCodeForTest(secret, (step - 2) * 30 + 1);
    const result = await verifyTotpCode(expired, secret);
    expect(result.valid).toBe(false);
  });

  it("rejects replay of a code from the last accepted time step", async () => {
    const secret = generateTotpSecret();
    const step = currentTotpStep();
    const code = await generateTotpCodeForTest(secret, step * 30 + 1);
    expect((await verifyTotpCode(code, secret, step - 1)).valid).toBe(true);
    expect((await verifyTotpCode(code, secret, step)).valid).toBe(false);
  });

  it("encrypts secrets with AES-256-GCM and detects tampering", () => {
    const secret = generateTotpSecret();
    const encrypted = encryptTotpSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(encrypted.startsWith("v1.")).toBe(true);
    expect(decryptTotpSecret(encrypted)).toBe(secret);

    const parts = encrypted.split(".");
    parts[3] = Buffer.from("tampered").toString("base64");
    expect(decryptTotpSecret(parts.join("."))).toBeNull();
    expect(decryptTotpSecret(null)).toBeNull();
    expect(decryptTotpSecret("garbage")).toBeNull();
  });
});
