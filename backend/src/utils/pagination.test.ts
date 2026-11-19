import { describe, expect, it } from "vitest";
import { getPagination, getSort, asArray, asNumber } from "./pagination";

describe("getPagination", () => {
  it("clamps invalid and excessive values", () => {
    const req = { query: { page: "not-a-number", pageSize: "10000", search: "  alpha  " } } as any;
    expect(getPagination(req)).toEqual({ page: 1, pageSize: 100, skip: 0, take: 100, search: "alpha" });
  });

  it("honours a custom maximum and offsets correctly", () => {
    const req = { query: { page: "3", pageSize: "25" } } as any;
    expect(getPagination(req, 20, 50)).toEqual({ page: 3, pageSize: 25, skip: 50, take: 25, search: undefined });
  });
});

describe("getSort", () => {
  it("allows only known columns and ascending directions", () => {
    const valid = getSort({ query: { sortBy: "fullName", sortDir: "asc" } } as any, ["fullName"], { createdAt: "desc" });
    expect(valid).toEqual({ fullName: "asc" });
    const rejected = getSort({ query: { sortBy: "passwordHash", sortDir: "desc" } } as any, ["fullName"], { createdAt: "desc" });
    expect(rejected).toEqual({ createdAt: "desc" });
  });
});

describe("normalisers", () => {
  it("parses arrays from strings and filters blanks", () => {
    expect(asArray("one, two ,, three")).toEqual(["one", "two", "three"]);
    expect(asArray(42 as any)).toEqual([]);
  });

  it("rejects non-finite numbers", () => {
    expect(asNumber("")).toBeUndefined();
    expect(asNumber("Infinite")).toBeUndefined();
    expect(asNumber("3.5")).toBe(3.5);
  });
});
