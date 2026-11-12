import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import Tesseract from "tesseract.js";
import { env } from "../config/env";

export interface ParsedCV {
  skills: string[];
  emails: string[];
  phones: string[];
  name?: string;
  experienceYears?: number;
  graduationYear?: number;
  qualification?: string;
  certifications: string[];
  organizations: string[];
  titles: string[];
  languages: string[];
  confidence: number;
}

export async function extractText(buffer: Buffer, mime: string, filename: string): Promise<string> {
  const lower = filename.toLowerCase();
  try {
    if (mime === "application/pdf" || lower.endsWith(".pdf")) {
      const result = await pdfParse(buffer);
      let text = result.text || "";
      if (text.trim().length < 40 && env.ocrEnabled) {
        try {
          const ocr = await Tesseract.recognize(buffer, env.ocrLanguages);
          if (ocr.data.text && ocr.data.text.trim().length > text.trim().length) text = ocr.data.text;
        } catch {}
      }
      return text;
    }
    if (mime.includes("word") || lower.endsWith(".docx") || lower.endsWith(".doc")) {
      const { value } = await mammoth.extractRawText({ buffer });
      return value || "";
    }
    if (mime === "text/plain" || lower.endsWith(".txt")) return buffer.toString("utf8");
    if (mime.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(lower)) {
      if (env.ocrEnabled) {
        try {
          const ocr = await Tesseract.recognize(buffer, env.ocrLanguages);
          return ocr.data.text || "";
        } catch { return ""; }
      }
      return "";
    }
    return buffer.toString("utf8");
  } catch {
    if (env.ocrEnabled && (mime.startsWith("image/") || mime === "application/pdf")) {
      try {
        const ocr = await Tesseract.recognize(buffer, env.ocrLanguages);
        return ocr.data.text || "";
      } catch { return ""; }
    }
    return "";
  }
}

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?\d{1,3}[.\-\s]?)?\(?\d{3}\)?[.\-\s]?\d{3}[.\-\s]?\d{4}/g;
const YEAR_RE = /\b(19|20)\d{2}\b/g;
const EXP_RE = /(\d+(?:\.\d+)?)\s*(?:\+)?\s*years?\s*(?:of)?\s*(?:relevant\s*)?experience/gi;

const QUAL_TIERS: Array<{ re: RegExp; rank: number; label: string }> = [
  { re: /ph\.?\s*d|doctorate/i, rank: 6, label: "PhD" },
  { re: /master|m\.?tech|m\.?sc|m\.?ba|post.?grad|pg/i, rank: 5, label: "Post Graduation" },
  { re: /bachelor|b\.?tech|b\.?e|b\.?sc|b\.?com|b\.?a|undergraduate/i, rank: 4, label: "Graduation" },
  { re: /diploma/i, rank: 3, label: "Diploma" },
  { re: /higher\s*secondary|12th|inter/i, rank: 2, label: "Class 12" },
  { re: /10th|matric|ssc/i, rank: 1, label: "Class 10" },
];

export function parseStructured(text: string, existingName?: string): ParsedCV {
  const clean = text.replace(/\s+/g, " ").trim();
  const emails = [...clean.matchAll(EMAIL_RE)].map((m) => m[0]);
  const phones = [...clean.matchAll(PHONE_RE)].map((m) => m[0]);
  const years = [...clean.matchAll(YEAR_RE)].map((m) => Number(m[0])).filter((y) => y >= 1900 && y <= new Date().getFullYear() + 2);
  const expMatches = [...clean.matchAll(EXP_RE)];
  let experienceYears: number | undefined;
  if (expMatches.length) experienceYears = parseFloat(expMatches[0][1]);
  const graduationYear = years.length ? years[years.length - 1] : undefined;

  let qualification: string | undefined;
  let rank = 0;
  for (const tier of QUAL_TIERS) {
    if (tier.re.test(clean)) { qualification = tier.label; rank = tier.rank; break; }
  }

  const certificationRe = /(?:certified|certification|certificate)\s+(?:in|of)?\s*([A-Za-z0-9 .\-]+)/gi;
  const certifications: string[] = [];
  for (const m of clean.matchAll(certificationRe)) {
    const c = m[1].trim().slice(0, 80);
    if (c && !certifications.includes(c)) certifications.push(c);
  }

  // Organizations / titles are very heuristic: look for common headings context.
  const organizations: string[] = [];
  const titles: string[] = [];
  const lines = clean.split(/\n|•|-/).map((l) => l.trim()).filter((l) => l.length > 2 && l.length < 100);
  for (const line of lines) {
    if (/experience|employment|work history|professional experience/i.test(line)) continue;
  }

  const languages: string[] = [];
  for (const lang of ["English","Hindi","French","German","Spanish","Telugu","Tamil","Kannada","Malayalam","Marathi","Bengali","Odia","Punjabi","Gujarati","Urdu","Arabic","Chinese","Japanese"]) {
    if (new RegExp(`\\b${lang}\\b`, "i").test(clean) && !languages.includes(lang)) languages.push(lang);
  }

  const name = existingName || (lines.slice(0, 3).find((l) => !EMAIL_RE.test(l) && !PHONE_RE.test(l) && !/^\d/.test(l)));

  let confidence = 0;
  if (emails.length) confidence += 25;
  if (phones.length) confidence += 15;
  if (experienceYears !== undefined) confidence += 20;
  if (graduationYear) confidence += 15;
  if (qualification) confidence += 15;
  if (clean.length > 500) confidence += 10;
  if (confidence > 100) confidence = 100;

  return { skills: [], emails, phones, name, experienceYears, graduationYear, qualification, certifications, organizations, titles, languages, confidence };
}
