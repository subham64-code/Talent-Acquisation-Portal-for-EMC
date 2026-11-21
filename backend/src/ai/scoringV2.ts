import type { ParsedCV } from "./extract";
import { canonicalize, presentIn } from "./scoring";

export const SCORING_V2_WEIGHTS: Record<ScoringDimension, number> = {
  skills: 30,
  experience: 25,
  qualification: 15,
  project: 15,
  role: 10,
  certification: 5,
};

export const SCORING_V2_THRESHOLDS = {
  strongMatch: 80,
  goodMatch: 65,
  partialMatch: 45,
  minimumCompleteness: 0.25,
  manualReviewCompleteness: 0.5,
};

export const SCORING_V2_VERSION = "v2.0.0";

export type ScoringDimension = "skills" | "experience" | "qualification" | "project" | "role" | "certification";
export type Applicability = "SCORED" | "NOT_APPLICABLE" | "UNKNOWN";
export type RecommendationCategory =
  | "STRONG_MATCH"
  | "GOOD_MATCH"
  | "PARTIAL_MATCH"
  | "MANUAL_REVIEW_REQUIRED"
  | "INSUFFICIENT_INFORMATION";

export interface DimensionScore {
  dimension: ScoringDimension;
  score: number | null;
  applicability: Applicability;
  weight: number;
  evidence: string[];
  reason: string;
}

export interface CandidateProfileForScoring {
  fullName: string;
  totalExperience?: number | null;
  relevantExperience?: number | null;
  qualification?: string | null;
  specialization?: string | null;
  skills?: string[];
  titles?: string[];
  organizations?: string[];
  projects?: Array<{ name?: string; description?: string; technologies?: string[] }>;
}

export interface JobForScoring {
  title?: string | null;
  description?: string | null;
  departmentName?: string | null;
  requiredSkills?: string[];
  preferredSkills?: string[];
  requiredCertifications?: string[];
  minExperience?: number | null;
  maxExperience?: number | null;
  relevantExperience?: number | null;
  requiredQualification?: string | null;
}

export interface MatchResultV2 {
  overallScore: number | null;
  dimensions: DimensionScore[];
  matchedSkills: string[];
  missingMandatorySkills: string[];
  relatedSkills: string[];
  extractionConfidence: number;
  dataCompleteness: number;
  missingEvidence: string[];
  recommendation: RecommendationCategory;
  explanation: string;
  weightsVersion: string;
  scoringVersion: string;
}

const STOP_WORDS = new Set([
  "and", "for", "with", "the", "from", "this", "that", "have", "has", "are", "was", "were",
  "will", "your", "our", "their", "into", "about", "against", "between", "through", "within",
]);

function tokens(value: unknown): string[] {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function tokenSet(value: unknown): Set<string> {
  return new Set(tokens(value));
}

function ratio(matched: number, total: number): number {
  return total > 0 ? Math.min(100, Math.round((matched / total) * 100)) : 0;
}

function dimension(
  name: ScoringDimension,
  weight: number,
  score: number | null,
  applicability: Applicability,
  evidence: string[],
  reason: string,
): DimensionScore {
  return { dimension: name, weight, score, applicability, evidence, reason };
}

function evidenceState(candidate: CandidateProfileForScoring, parsed: ParsedCV): { present: boolean[]; missing: string[] } {
  const state = [
    { present: (candidate.skills?.length ?? 0) + parsed.skills.length > 0, label: "skills" },
    {
      present: candidate.totalExperience != null || candidate.relevantExperience != null || parsed.experienceYears != null,
      label: "experience",
    },
    { present: Boolean(candidate.qualification || parsed.qualification), label: "qualification" },
    { present: (candidate.titles?.length ?? 0) + parsed.titles.length > 0, label: "employment history" },
    { present: (candidate.projects?.length ?? 0) + (parsed.projects?.length ?? 0) > 0, label: "projects" },
    { present: parsed.certifications.length > 0, label: "certifications" },
  ];
  return {
    present: state.map((item) => item.present),
    missing: state.filter((item) => !item.present).map((item) => item.label),
  };
}

/**
 * Six-dimensional, explainable matching engine.
 *
 * This is intentionally additive: the original `scoreMatch` in scoring.ts is
 * untouched so existing API contracts and stored scores keep working. A
 * dimension with no reliable evidence is reported as UNKNOWN and excluded from
 * the weighted average rather than being treated as a successful match.
 */
export function scoreMatchV2(
  candidate: CandidateProfileForScoring,
  parsed: ParsedCV,
  job: JobForScoring,
  weights: Partial<Record<ScoringDimension, number>> = SCORING_V2_WEIGHTS,
): MatchResultV2 {
  const effectiveWeights = { ...SCORING_V2_WEIGHTS, ...weights };
  const candidateSkills = canonicalize([...(candidate.skills ?? []), ...parsed.skills]);
  const required = (job.requiredSkills ?? []).filter(Boolean);
  const preferred = (job.preferredSkills ?? []).filter(Boolean);

  const matchedSkills: string[] = [];
  const missingMandatorySkills: string[] = [];
  for (const skill of required) {
    if (presentIn(skill, candidateSkills)) matchedSkills.push(skill);
    else missingMandatorySkills.push(skill);
  }
  const relatedSkills = preferred.filter((skill) => presentIn(skill, candidateSkills));

  const dimensions: DimensionScore[] = [];

  if (required.length > 0) {
    dimensions.push(dimension(
      "skills",
      effectiveWeights.skills,
      ratio(matchedSkills.length, required.length),
      "SCORED",
      [
        `Matched ${matchedSkills.length} of ${required.length} mandatory skills`,
        ...(missingMandatorySkills.length ? [`Missing: ${missingMandatorySkills.slice(0, 5).join(", ")}`] : []),
        ...(relatedSkills.length ? [`Preferred skills present: ${relatedSkills.slice(0, 5).join(", ")}`] : []),
      ],
      "Mandatory skill coverage from resume and profile skills",
    ));
  } else if (preferred.length > 0) {
    dimensions.push(dimension(
      "skills",
      effectiveWeights.skills,
      ratio(relatedSkills.length, preferred.length),
      "SCORED",
      [`Matched ${relatedSkills.length} of ${preferred.length} preferred skills`],
      "No mandatory skills supplied; preferred skills used as evidence",
    ));
  } else {
    dimensions.push(dimension(
      "skills",
      effectiveWeights.skills,
      null,
      "UNKNOWN",
      [],
      "No required or preferred skills supplied for this vacancy",
    ));
  }

  const relevantYears = candidate.relevantExperience ?? parsed.experienceYears ?? candidate.totalExperience ?? null;
  const requiredYears = job.minExperience ?? job.relevantExperience ?? null;
  if (requiredYears != null && relevantYears != null) {
    let experienceScore: number;
    if (job.maxExperience != null && relevantYears > job.maxExperience) {
      experienceScore = 85;
    } else if (relevantYears >= requiredYears) {
      experienceScore = 100;
    } else {
      experienceScore = Math.max(0, Math.round(Math.pow(relevantYears / Math.max(requiredYears, 1), 0.8) * 100));
    }
    dimensions.push(dimension(
      "experience",
      effectiveWeights.experience,
      Math.min(100, experienceScore),
      "SCORED",
      [`${relevantYears} relevant year(s) against a ${requiredYears}-year requirement`],
      "Relevant experience compared with the stated minimum",
    ));
  } else if (requiredYears != null) {
    dimensions.push(dimension(
      "experience",
      effectiveWeights.experience,
      null,
      "UNKNOWN",
      [],
      "Experience requirement exists but no reliable experience evidence was found",
    ));
  } else {
    dimensions.push(dimension(
      "experience",
      effectiveWeights.experience,
      null,
      "NOT_APPLICABLE",
      [],
      "No experience requirement supplied for this vacancy",
    ));
  }

  const degreeRank: Record<string, number> = { PhD: 6, "Post Graduation": 5, Graduation: 4, Diploma: 3, "Class 12": 2, "Class 10": 1 };
  const candidateQualification = candidate.qualification || parsed.qualification;
  const requiredQualification = String(job.requiredQualification ?? "").toLowerCase();
  let requiredRank = 0;
  if (/ph\.?\s*d|doctorate/.test(requiredQualification)) requiredRank = 6;
  else if (/master|m\.?tech|m\.?sc|m\.?ba|post.?grad|pg/.test(requiredQualification)) requiredRank = 5;
  else if (/bachelor|b\.?tech|b\.?e|b\.?sc|b\.?com|b\.?a|undergraduate/.test(requiredQualification)) requiredRank = 4;
  else if (/diploma/.test(requiredQualification)) requiredRank = 3;

  if (candidateQualification) {
    const actualRank = degreeRank[candidateQualification] ?? 0;
    let qualificationScore: number;
    if (requiredRank > 0) qualificationScore = actualRank >= requiredRank ? 100 : Math.round((actualRank / requiredRank) * 70);
    else qualificationScore = actualRank >= 6 ? 100 : actualRank === 5 ? 85 : actualRank === 4 ? 70 : actualRank === 3 ? 55 : 40;
    dimensions.push(dimension(
      "qualification",
      effectiveWeights.qualification,
      qualificationScore,
      "SCORED",
      [`Candidate qualification: ${candidateQualification}`, ...(requiredRank ? [`Required rank: ${requiredRank}`] : [])],
      "Degree level compared with the stated qualification requirement",
    ));
  } else if (requiredRank > 0) {
    dimensions.push(dimension(
      "qualification",
      effectiveWeights.qualification,
      null,
      "UNKNOWN",
      [],
      "Qualification required but no qualification evidence found",
    ));
  } else {
    dimensions.push(dimension(
      "qualification",
      effectiveWeights.qualification,
      null,
      "NOT_APPLICABLE",
      [],
      "No qualification requirement and no qualification evidence",
    ));
  }

  const projects = candidate.projects?.length ? candidate.projects : (parsed.projects ?? []);
  if (projects.length > 0) {
    const jobSkills = tokenSet([...(job.requiredSkills ?? []), ...(job.preferredSkills ?? []), job.description ?? ""]);
    const projectTokens = new Set<string>();
    for (const project of projects) {
      for (const token of tokens([project.name, project.description, ...(project.technologies ?? [])].join(" "))) projectTokens.add(token);
    }
    const overlap = [...jobSkills].filter((token) => projectTokens.has(token)).length;
    dimensions.push(dimension(
      "project",
      effectiveWeights.project,
      jobSkills.size > 0 ? ratio(overlap, jobSkills.size) : null,
      jobSkills.size > 0 ? "SCORED" : "UNKNOWN",
      [`${projects.length} project(s) analysed`, `${overlap} project term(s) relevant to the vacancy`],
      "Project technologies and descriptions compared with job requirements",
    ));
  } else {
    dimensions.push(dimension(
      "project",
      effectiveWeights.project,
      null,
      "UNKNOWN",
      [],
      "No project evidence available for this candidate",
    ));
  }

  const jobRoleTokens = tokenSet([job.title ?? "", job.description ?? "", job.departmentName ?? ""]);
  const candidateRoleTokens = tokenSet([
    ...(candidate.titles ?? []),
    ...parsed.titles,
    candidate.specialization ?? "",
    ...(candidate.organizations ?? []),
    ...parsed.organizations,
  ]);
  if (jobRoleTokens.size > 0 && candidateRoleTokens.size > 0) {
    const overlap = [...jobRoleTokens].filter((token) => candidateRoleTokens.has(token)).length;
    dimensions.push(dimension(
      "role",
      effectiveWeights.role,
      ratio(overlap, jobRoleTokens.size),
      "SCORED",
      [`${overlap} of ${jobRoleTokens.size} role term(s) supported by employment history`],
      "Role relevance from titles, responsibilities, specialization and domain",
    ));
  } else {
    dimensions.push(dimension(
      "role",
      effectiveWeights.role,
      null,
      "UNKNOWN",
      [],
      "Insufficient role or job-description evidence",
    ));
  }

  const requiredCertifications = (job.requiredCertifications ?? []).filter(Boolean);
  if (requiredCertifications.length > 0) {
    const matched = requiredCertifications.filter((cert) =>
      parsed.certifications.some((held) => held.toLowerCase().includes(cert.toLowerCase()) || cert.toLowerCase().includes(held.toLowerCase())),
    );
    dimensions.push(dimension(
      "certification",
      effectiveWeights.certification,
      ratio(matched.length, requiredCertifications.length),
      "SCORED",
      [`Matched ${matched.length} of ${requiredCertifications.length} required certification(s)`],
      "Required certifications checked against resume evidence",
    ));
  } else {
    dimensions.push(dimension(
      "certification",
      effectiveWeights.certification,
      null,
      "NOT_APPLICABLE",
      [],
      "No certifications required for this vacancy",
    ));
  }

  const scored = dimensions.filter((item) => item.applicability === "SCORED" && item.score != null);
  const totalWeight = scored.reduce((sum, item) => sum + item.weight, 0);
  const overallScore = totalWeight > 0
    ? Math.round(scored.reduce((sum, item) => sum + (item.score as number) * item.weight, 0) / totalWeight)
    : null;

  const evidence = evidenceState(candidate, parsed);
  const dataCompleteness = Math.round((evidence.present.filter(Boolean).length / evidence.present.length) * 100) / 100;
  const extractionConfidence = parsed.confidence;
  
  let recommendation: RecommendationCategory;
  if (overallScore == null || scored.length < 2 || dataCompleteness < SCORING_V2_THRESHOLDS.minimumCompleteness || extractionConfidence < 0.3) {
    recommendation = "INSUFFICIENT_INFORMATION";
  } else if (missingMandatorySkills.length > 0 || dataCompleteness < SCORING_V2_THRESHOLDS.manualReviewCompleteness) {
    recommendation = "MANUAL_REVIEW_REQUIRED";
  } else if (overallScore >= SCORING_V2_THRESHOLDS.strongMatch) {
    recommendation = "STRONG_MATCH";
  } else if (overallScore >= SCORING_V2_THRESHOLDS.goodMatch) {
    recommendation = "GOOD_MATCH";
  } else if (overallScore >= SCORING_V2_THRESHOLDS.partialMatch) {
    recommendation = "PARTIAL_MATCH";
  } else {
    recommendation = "MANUAL_REVIEW_REQUIRED";
  }

  const explanation = [
    ...dimensions.map((item) => `${item.dimension}: ${item.applicability === "SCORED" ? `${item.score}%` : item.applicability.toLowerCase()} (${item.reason})`),
    ...(evidence.missing.length ? [`Missing evidence: ${evidence.missing.join(", ")}`] : []),
    `Extraction confidence: ${Math.round(extractionConfidence * 100)}%`,
  ].join("; ");
  
  return {
    overallScore,
    dimensions,
    matchedSkills,
    missingMandatorySkills,
    relatedSkills,
    extractionConfidence,
    dataCompleteness,
    missingEvidence: evidence.missing,
    recommendation,
    explanation,
    weightsVersion: SCORING_V2_VERSION,
    scoringVersion: SCORING_V2_VERSION,
  };
}
