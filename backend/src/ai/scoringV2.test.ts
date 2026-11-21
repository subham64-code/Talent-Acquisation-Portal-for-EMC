import { describe, expect, it } from "vitest";
import { scoreMatchV2, SCORING_V2_VERSION, SCORING_V2_WEIGHTS } from "./scoringV2";
import type { ParsedCV } from "./extract";

function parsed(overrides: Partial<ParsedCV> = {}): ParsedCV {
  return {
    skills: [],
    emails: [],
    phones: [],
    certifications: [],
    organizations: [],
    titles: [],
    languages: [],
    confidence: 0.8,
    ...overrides,
  };
}

const candidate = {
  fullName: "Test Candidate",
  totalExperience: 6,
  relevantExperience: 5,
  qualification: "Graduation",
  specialization: "GIS",
  skills: ["ArcGIS", "QGIS"],
  titles: ["GIS Engineer"],
  organizations: ["Ecometrix"],
  projects: [{ name: "City mapping", description: "Spatial analysis and geospatial mapping", technologies: ["QGIS", "GPS"] }],
};

const job = {
  title: "GIS Engineer",
  description: "Spatial analysis and geospatial mapping using ArcGIS",
  departmentName: "GIS",
  requiredSkills: ["ArcGIS", "QGIS"],
  preferredSkills: ["Python"],
  requiredCertifications: [],
  minExperience: 3,
  maxExperience: 8,
  requiredQualification: "Bachelor",
};

describe("scoreMatchV2", () => {
  it("uses the six proposed weights and exposes a version", () => {
    expect(SCORING_V2_WEIGHTS).toEqual({ skills: 30, experience: 25, qualification: 15, project: 15, role: 10, certification: 5 });
    expect(Object.values(SCORING_V2_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBe(100);
    const result = scoreMatchV2(candidate, parsed(), job);
    expect(result.scoringVersion).toBe(SCORING_V2_VERSION);
    expect(result.dimensions.map((item) => item.dimension)).toEqual([
      "skills", "experience", "qualification", "project", "role", "certification",
    ]);
  });

  it("matches skills through aliases without double counting", () => {
    const result = scoreMatchV2(
      { ...candidate, skills: ["NodeJS", "React.js"] },
      parsed({ skills: ["JavaScript"] }),
      { ...job, requiredSkills: ["Node.js", "React"], preferredSkills: [] },
    );
    expect(result.matchedSkills).toEqual(["Node.js", "React"]);
    expect(result.missingMandatorySkills).toEqual([]);
    expect(result.dimensions[0].score).toBe(100);
  });

  it("reports missing mandatory skills and requires manual review", () => {
    const result = scoreMatchV2(
      candidate,
      parsed(),
      { ...job, requiredSkills: ["ArcGIS", "AutoCAD"] },
    );
    expect(result.missingMandatorySkills).toContain("AutoCAD");
    expect(result.recommendation).toBe("MANUAL_REVIEW_REQUIRED");
  });

  it("excludes non-applicable dimensions from the weighted average", () => {
    const result = scoreMatchV2(candidate, parsed(), job);
    const certification = result.dimensions.find((item) => item.dimension === "certification");
    expect(certification?.applicability).toBe("NOT_APPLICABLE");
    expect(certification?.score).toBeNull();
    expect(result.overallScore).not.toBeNull();
  });

  it("returns insufficient information when there is no reliable evidence", () => {
    const result = scoreMatchV2(
      { fullName: "Unknown" },
      parsed({ confidence: 0.1 }),
      { title: "Any role" },
    );
    expect(result.overallScore).toBeNull();
    expect(result.recommendation).toBe("INSUFFICIENT_INFORMATION");
    expect(result.dataCompleteness).toBeLessThan(0.5);
  });

  it("keeps extraction confidence separate from the match score", () => {
    const lowConfidence = scoreMatchV2(candidate, parsed({ confidence: 0.2 }), job);
    const highConfidence = scoreMatchV2(candidate, parsed({ confidence: 0.95 }), job);
    expect(lowConfidence.overallScore).toBe(highConfidence.overallScore);
    expect(lowConfidence.extractionConfidence).toBe(0.2);
    expect(highConfidence.extractionConfidence).toBe(0.95);
  });

  it("redistributes weight when a dimension is not applicable", () => {
    const result = scoreMatchV2(candidate, parsed(), { ...job, requiredCertifications: [], requiredSkills: [] });
    const scored = result.dimensions.filter((item) => item.applicability === "SCORED" && item.score != null);
    const expected = Math.round(
      scored.reduce((sum, item) => sum + (item.score as number) * item.weight, 0) /
        scored.reduce((sum, item) => sum + item.weight, 0),
    );
    expect(result.dimensions.find((item) => item.dimension === "certification")?.applicability).toBe("NOT_APPLICABLE");
    expect(result.overallScore).toBe(expected);
  });

  it("does not double count equivalent skill names", () => {
    const result = scoreMatchV2(
      { ...candidate, skills: ["Node.js", "NodeJS", "Node"] },
      parsed(),
      { ...job, requiredSkills: ["Node.js"] },
    );
    expect(result.matchedSkills).toEqual(["Node.js"]);
    expect(result.dimensions[0].score).toBe(100);
  });

  it("ignores personal attributes when scoring", () => {
    const base = scoreMatchV2(candidate, parsed(), job);
    const renamed = scoreMatchV2({ ...candidate, fullName: "Completely Different Name" }, parsed(), job);
    expect(renamed.overallScore).toBe(base.overallScore);
    expect(renamed.dimensions).toEqual(base.dimensions);
  });

  it("reports which evidence is missing instead of inventing values", () => {
    const result = scoreMatchV2(
      { fullName: "Sparse Candidate" },
      parsed({ confidence: 0.7 }),
      { ...job, requiredSkills: ["ArcGIS"] },
    );
    expect(result.missingEvidence).toContain("skills");
    expect(result.missingEvidence).toContain("projects");
    expect(result.explanation).toContain("Missing evidence:");
  });

  it("marks low-confidence extractions as insufficient information", () => {
    const result = scoreMatchV2(candidate, parsed({ confidence: 0.2 }), job);
    expect(result.recommendation).toBe("INSUFFICIENT_INFORMATION");
  });

  it("uses resume project evidence when no profile projects are supplied", () => {
    const withoutProjects = scoreMatchV2({ ...candidate, projects: [] }, parsed(), job);
    const withProjects = scoreMatchV2(
      { ...candidate, projects: [] },
      parsed({ projects: [{ description: "Spatial analysis using ArcGIS", technologies: ["ArcGIS", "QGIS"] }] }),
      job,
    );
    const projectScore = (result: typeof withProjects) => result.dimensions.find((item) => item.dimension === "project")?.score;
    expect(projectScore(withoutProjects)).toBeNull();
    expect(projectScore(withProjects)).toBeGreaterThan(0);
  });

  it("never produces an automatic rejection decision", () => {
    const result = scoreMatchV2(
      { fullName: "Weak Candidate" },
      parsed({ skills: [], certifications: [], titles: [], organizations: [] }),
      { ...job, requiredSkills: ["AutoCAD", "STAAD Pro"], minExperience: 15 },
    );
    expect(["MANUAL_REVIEW_REQUIRED", "INSUFFICIENT_INFORMATION"]).toContain(result.recommendation);
  });
});
