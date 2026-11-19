import { describe, expect, it } from "vitest";
import { verifyAuthToken, verifyPurposeToken, signPurposeToken, signAuthToken } from "./jwt";

describe("JWT helpers", () => {
  it("round-trips authentication payloads", () => {
    const token = signAuthToken({ sub: "subject-1", type: "HR", sid: "session-1" }, "5m");
    expect(verifyAuthToken(token)).toMatchObject({ sub: "subject-1", type: "HR", sid: "session-1" });
  });

  it("rejects a malformed authentication token", () => {
    expect(() => verifyAuthToken("not-a-token")).toThrow(/invalid or has expired/i);
  });

  it("binds purpose tokens to their declared purpose and data", () => {
    const token = signPurposeToken({ fileId: "file-123" }, "FILE_ACCESS", "5m");
    expect(verifyPurposeToken(token, "FILE_ACCESS")).toMatchObject({ fileId: "file-123", purpose: "FILE_ACCESS" });
  });

  it("rejects purpose token reuse across scopes", () => {
    const token = signPurposeToken({ fileId: "file-123" }, "FILE_ACCESS", "5m");
    expect(() => verifyPurposeToken(token, "DOC_UPLOAD")).toThrow(/not valid for this action/i);
  });
});
