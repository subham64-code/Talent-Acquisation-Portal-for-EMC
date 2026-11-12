import { ParsedCV } from "./extract";

const SKILL_GROUPS: Array<string[]> = [
  ["JavaScript", "JS", "ECMAScript"],
  ["TypeScript", "TS"],
  ["React", "React.js", "ReactJS"],
  ["Angular", "Angular.js"],
  ["Vue", "Vue.js", "VueJS"],
  ["Node.js", "Node", "NodeJS"],
  ["Python", "Py"],
  ["Java", "J2EE"],
  ["C#", "CSharp", ".NET", "DotNet", "ASP.NET"],
  ["C++", "CPP"],
  ["SQL", "Structured Query Language"],
  ["PostgreSQL", "Postgres", "PG"],
  ["MySQL", "My SQL"],
  ["Oracle", "Oracle DB"],
  ["MongoDB", "Mongo"],
  ["Redis", "Redis DB"],
  ["Microsoft Excel", "MS Excel", "Excel"],
  ["Microsoft Word", "MS Word", "Word"],
  ["Microsoft PowerPoint", "MS PowerPoint", "PowerPoint"],
  ["Microsoft Project", "MS Project", "MPP"],
  ["AutoCAD", "Auto CAD"],
  ["Revit", "Autodesk Revit"],
  ["STAAD", "STAAD.Pro"],
  ["ETABS", "ETABS"],
  ["ArcGIS", "GIS"],
  ["QGIS", "GIS"],
  ["Primavera", "P6", "Primavera P6"],
  ["AWS", "Amazon Web Services"],
  ["Azure", "Microsoft Azure"],
  ["GCP", "Google Cloud Platform"],
  ["Docker", "Containerization"],
  ["Kubernetes", "K8s"],
  ["CI/CD", "DevOps"],
  ["HTML", "HTML5"],
  ["CSS", "CSS3"],
  ["UI/UX", "UX Design"],
  ["QA", "Quality Assurance", "Testing"],
];

const SYNONYM_TO_CANONICAL = new Map<string, string>();
for (const group of SKILL_GROUPS) {
  const canonical = group[0];
  for (const alias of group) SYNONYM_TO_CANONICAL.set(normalizeSkill(alias), canonical);
}

export function normalizeSkill(skill: string): string {
  return skill
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalize(skills: string[]): Set<string> {
  const set = new Set<string>();
  for (const s of skills) {
    const n = normalizeSkill(s);
    if (!n) continue;
    set.add(SYNONYM_TO_CANONICAL.get(n) || n);
  }
  return set;
}

export function presentIn(skill: string, candidateSkills: Set<string>): boolean {
  return candidateSkills.has(normalizeSkill(skill)) || candidateSkills.has(SYNONYM_TO_CANONICAL.get(normalizeSkill(skill)) || normalizeSkill(skill));
}

export interface ScoredMatch {
  overallScore: number;
  skillScore: number;
  experienceScore: number;
  qualificationScore: number;
  domainScore: number;
  certificationScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  strengths: string[];
  gaps: string[];
  explanation: string;
  extractionConfidence: number;
  weights: Record<string, number>;
}

const DEGREE_ORDER: Record<string, number> = { PhD: 6, "Post Graduation": 5, Graduation: 4, Diploma: 3, "Class 12": 2, "Class 10": 1 };

export function scoreMatch(
  candidate: { fullName: string; totalExperience?: number | null; relevantExperience?: number | null; qualification?: string | null; specialization?: string | null },
  skills: string[],
  parsed: ParsedCV,
  job: {
    requiredSkills: string[];
    preferredSkills: string[];
    requiredCertifications: string[];
    minExperience?: number | null;
    maxExperience?: number | null;
    relevantExperience?: number | null;
    requiredQualification?: string | null;
    description?: string | null;
    department?: { name?: string } | null;
    program?: { name?: string } | null;
  },
  weights: Record<string, number>,
): ScoredMatch {
  const candidateSkills = canonicalize([...skills, ...parsed.skills]);
  const required = job.requiredSkills.filter(Boolean);
  const preferred = job.preferredSkills.filter(Boolean);

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  for (const s of required) {
    if (presentIn(s, candidateSkills)) matchedSkills.push(s);
    else missingSkills.push(s);
  }

  let skillScore = 0;
  if (required.length) skillScore = Math.round((matchedSkills.length / required.length) * 100);
  else if (preferred.length) {
    const prefMatched = preferred.filter((s) => presentIn(s, candidateSkills)).length;
    skillScore = Math.round((prefMatched / preferred.length) * 100);
  } else skillScore = 60;

  // Experience
  let experienceScore = 70;
  const relevant = candidate.relevantExperience ?? parsed.experienceYears ?? 0;
  const total = candidate.totalExperience ?? 0;
  if (job.minExperience != null && job.maxExperience != null) {
    if (relevant >= job.minExperience && relevant <= job.maxExperience) experienceScore = 100;
    else if (relevant < job.minExperience) experienceScore = Math.round((relevant / job.minExperience) * 100);
    else experienceScore = 85;
  } else if (job.minExperience != null) {
    experienceScore = relevant >= job.minExperience ? 100 : Math.round((relevant / job.minExperience) * 100);
  } else if (job.relevantExperience != null) {
    experienceScore = relevant >= job.relevantExperience ? 100 : Math.round((relevant / job.relevantExperience) * 100);
  } else {
    experienceScore = total >= 5 ? 100 : Math.round((total / 5) * 100);
  }
  experienceScore = Math.min(100, Math.max(0, experienceScore));

  // Qualification
  let qualificationScore = 50;
  const reqQual = job.requiredQualification ? job.requiredQualification.toLowerCase() : "";
  let reqRank = 0;
  if (reqQual.includes("phd") || reqQual.includes("doctorate")) reqRank = 6;
  else if (reqQual.includes("master") || reqQual.includes("postgrad") || reqQual.includes("m.")) reqRank = 5;
  else if (reqQual.includes("bachelor") || reqQual.includes("b.")) reqRank = 4;
  else if (reqQual.includes("diploma")) reqRank = 3;
  const candRank = candidate.qualification ? DEGREE_ORDER[candidate.qualification] ?? (parsed.qualification ? DEGREE_ORDER[parsed.qualification] : 0) : (parsed.qualification ? DEGREE_ORDER[parsed.qualification] : 0);
  if (!reqQual) {
    qualificationScore = candRank === 6 ? 100 : candRank === 5 ? 85 : candRank === 4 ? 70 : candRank === 3 ? 55 : 40;
  } else {
    qualificationScore = candRank >= reqRank ? 100 : Math.round((candRank / reqRank) * 70);
  }

  // Domain
  const domainKeywords = new Set<string>();
  const textSources = [(job.description || ""), (job.department?.name || ""), (job.program?.name || ""), (candidate.specialization || ""), (parsed.organizations.join(" ")), (parsed.titles.join(" "))].join(" ");
  const domainWords = ["urban", "planning", "gis", "telecom", "bde", "accounts", "finance", "survey", "design", "drainage", "water", "civil", "mechanical", "hydraulics", "mis", "data", "analytics", "hr", "security", "research", "development"];
  const foundDomain = domainWords.filter((w) => textSources.toLowerCase().includes(w));
  const domainScore = foundDomain.length ? Math.min(100, foundDomain.length * 20 + 20) : 50;

  // Certification
  let certificationScore = 50;
  const reqCerts = job.requiredCertifications.filter(Boolean);
  if (reqCerts.length) {
    const certMatched = reqCerts.filter((c) => parsed.certifications.some((pc) => pc.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(pc.toLowerCase()))).length;
    certificationScore = Math.round((certMatched / reqCerts.length) * 100);
  } else if (preferred.length) {
    const prefMatched = preferred.filter((s) => presentIn(s, candidateSkills)).length;
    certificationScore = Math.round((prefMatched / preferred.length) * 60 + 40);
  }

  const overall = Math.round(
    (skillScore * weights.skills +
      experienceScore * weights.experience +
      qualificationScore * weights.qualification +
      domainScore * weights.domain +
      certificationScore * weights.certification) /
      100,
  );

  const strengths: string[] = [];
  const gaps: string[] = [];
  if (matchedSkills.length) strengths.push(`${matchedSkills.length} required skill(s) matched`);
  if (missingSkills.length) gaps.push(`Missing required skill(s): ${missingSkills.slice(0, 5).join(", ")}`);
  if (experienceScore >= 90) strengths.push("Experience meets requirements");
  else if (experienceScore < 60) gaps.push("Experience below requirement");
  if (qualificationScore >= 90) strengths.push("Qualification meets or exceeds requirement");
  else if (qualificationScore < 60) gaps.push("Qualification below requirement");
  if (parsed.certifications.length) strengths.push(`${parsed.certifications.length} certification(s) found`);

  const explanation = `Overall match ${overall}% based on skills (${skillScore}%), experience (${experienceScore}%), qualification (${qualificationScore}%), domain (${domainScore}%), and certifications (${certificationScore}%). ${strengths.join("; ")}. ${gaps.join("; ")}`.trim();

  return {
    overallScore: overall,
    skillScore,
    experienceScore,
    qualificationScore,
    domainScore,
    certificationScore,
    matchedSkills,
    missingSkills,
    strengths,
    gaps,
    explanation,
    extractionConfidence: parsed.confidence,
    weights,
  };
}
