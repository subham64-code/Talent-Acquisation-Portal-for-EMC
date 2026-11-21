import { describe, expect, it } from "vitest";
import { parseStructured } from "./extract";

const resume = `Jane Doe
jane.doe@example.com | 9876543210

EXPERIENCE
Senior GIS Engineer at Ecometrix Consultants Pvt Ltd
Worked on spatial analysis and geospatial mapping.

PROJECTS
- City drainage mapping using QGIS and GPS Surveying
  Built spatial analysis workflows for urban planning.

EDUCATION
Bachelor of Technology, 2018
Certified in ArcGIS

SKILLS
ArcGIS, QGIS, Python, SQL, Remote Sensing`;

describe("parseStructured", () => {
  it("detects skills from resume text without inventing them", () => {
    const result = parseStructured(resume, "Jane Doe");
    expect(result.skills).toContain("ArcGIS");
    expect(result.skills).toContain("QGIS");
    expect(result.skills).toContain("Python");
    expect(result.qualification).toBe("Graduation");
  });

  it("extracts project evidence with source text", () => {
    const result = parseStructured(resume, "Jane Doe");
    expect(result.projects.length).toBeGreaterThan(0);
    expect(result.projects[0].description).toContain("QGIS");
    expect(result.projects[0].technologies).toContain("QGIS");
  });

  it("keeps missing information unknown", () => {
    const result = parseStructured("Candidate with no details", "Unknown");
    expect(result.skills).toEqual([]);
    expect(result.projects).toEqual([]);
    expect(result.experienceYears).toBeUndefined();
    expect(result.confidence).toBeLessThan(0.3);
  });

  it("exposes confidence as a 0-1 ratio expected by scoring and the UI", () => {
    const result = parseStructured(resume, "Jane Doe");
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
