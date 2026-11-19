import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  APPLICATION_STATUS,
  APPLICATION_TRANSITIONS,
  ROLE_PERMISSIONS,
  EMAIL_TEMPLATE_KEYS,
} from "./constants";

describe("application workflow configuration", () => {
  it("keeps every workflow transition on a known application status", () => {
    const statuses = new Set(Object.values(APPLICATION_STATUS));
    for (const status of Object.keys(APPLICATION_TRANSITIONS)) {
      expect(statuses.has(status as any)).toBe(true);
      for (const target of APPLICATION_TRANSITIONS[status]) {
        expect(statuses.has(target)).toBe(true);
      }
    }
  });

  it("does not allow hired or withdrawn candidates to re-enter the pipeline", () => {
    expect(APPLICATION_TRANSITIONS.HIRED).toEqual([]);
    expect(APPLICATION_TRANSITIONS.WITHDRAWN).toEqual([]);
  });

  it("contains unique email templates", () => {
    expect(new Set(EMAIL_TEMPLATE_KEYS).size).toBe(EMAIL_TEMPLATE_KEYS.length);
  });
});

describe("role permissions", () => {
  const known = new Set<string>(ALL_PERMISSIONS);

  it("contains no unknown permission keys", () => {
    for (const permissions of Object.values(ROLE_PERMISSIONS)) {
      for (const permission of permissions) {
        expect(known.has(permission)).toBe(true);
      }
    }
  });

  it("grants singular controllers full access", () => {
    expect([...ROLE_PERMISSIONS.SUPER_ADMIN].sort()).toEqual([...ALL_PERMISSIONS].sort());
    expect([...ROLE_PERMISSIONS.IT_ADMIN].sort()).toEqual([...ALL_PERMISSIONS].sort());
  });
});
