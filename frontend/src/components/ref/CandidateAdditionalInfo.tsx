import { useMemo } from "react";

type UnknownRecord = Record<string, unknown>;

const LABELS: Record<string, string> = {
  country: "Country",
  state: "State",
  city: "City",
  dateOfBirth: "Date of Birth",
  gender: "Gender",
  highestQualification: "Highest Qualification",
  technicalSkills: "Technical Skills",
  professionalSkills: "Professional Skills",
  qualifications: "Qualifications",
  linkedIn: "LinkedIn",
  linkedin: "LinkedIn",
  currentLocation: "Current Location",
  totalExperience: "Total Experience",
  relevantExperience: "Relevant Experience",
};

const knownKeys = new Set([
  "country",
  "state",
  "city",
  "dateOfBirth",
  "gender",
  "highestQualification",
  "technicalSkills",
  "professionalSkills",
  "qualifications",
]);

const humanize = (key: string) =>
  LABELS[key] ?? key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());

const formatScalar = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
    }
  }
  return text;
};

const asArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === "") return [];
  return [value];
};

const asStrings = (value: unknown): string[] =>
  asArray(value)
    .flatMap((item) => {
      if (item && typeof item === "object") return Object.values(item).map(formatScalar).filter((text) => text !== "—");
      return [formatScalar(item)];
    })
    .filter((item) => item !== "—");

const renderObjectEntries = (value: UnknownRecord): Array<{ label: string; value: string }> =>
  Object.entries(value).map(([key, item]) => ({ label: humanize(key), value: formatScalar(item) }));

function Qualifications({ value }: { value: unknown }) {
  const qualifications = asArray(value);
  if (qualifications.length === 0) return null;
  return (
    <div className="candidate-additional-block">
      <div className="candidate-additional-block__title">Qualifications</div>
      <div className="candidate-additional-list">
        {qualifications.map((qualification, index) => {
          if (qualification && typeof qualification === "object") {
            const record = qualification as UnknownRecord;
            const title = record.degree ?? record.qualification ?? record.course ?? record.level ?? record.name ?? `Qualification ${index + 1}`;
            const entries = renderObjectEntries(record).filter((entry) => entry.label !== "Degree");
            return (
              <article className="candidate-additional-item" key={index}>
                <div className="candidate-additional-item__title">{formatScalar(title)}</div>
                <div className="candidate-additional-item__grid">
                  {entries.map((entry) => (
                    <div className="candidate-additional-item__row" key={entry.label}>
                      <span>{entry.label}</span>
                      <strong>{entry.value}</strong>
                    </div>
                  ))}
                </div>
              </article>
            );
          }
          return <article className="candidate-additional-item" key={index}><div className="candidate-additional-item__title">{formatScalar(qualification)}</div></article>;
        })}
      </div>
    </div>
  );
}

export default function CandidateAdditionalInfo({ value }: { value?: string | null }) {
  const parsed = useMemo((): UnknownRecord | string | null => {
    if (!value?.trim()) return null;
    try {
      const candidate = JSON.parse(value);
      return candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate as UnknownRecord : null;
    } catch {
      return value;
    }
  }, [value]);

  if (typeof parsed === "string") {
    return (
      <section className="candidate-additional-card">
        <div className="candidate-additional-card__header">Candidate-provided additional information</div>
        <p className="candidate-additional-prose">{parsed}</p>
      </section>
    );
  }

  if (!parsed) return null;

  const record = parsed;
  const personalKeys = ["dateOfBirth", "gender", "country", "state", "city", "highestQualification"];
  const personalEntries = personalKeys.filter((key) => record[key] !== undefined && record[key] !== null && record[key] !== "").map((key) => ({ label: humanize(key), value: formatScalar(record[key]) }));
  const technicalSkills = asStrings(record.technicalSkills);
  const professionalSkills = asStrings(record.professionalSkills);
  const otherEntries = Object.entries(record).filter(([key, item]) => !knownKeys.has(key) && item !== null && item !== undefined && item !== "").map(([key, item]) => ({ key, label: humanize(key), value: asArray(item).map(formatScalar).join(", ") }));

  return (
    <section className="candidate-additional-card">
      <div className="candidate-additional-card__header">Candidate-provided additional details</div>
      <div className="candidate-additional-card__body">
        {personalEntries.length > 0 && (
          <div className="candidate-additional-block">
            <div className="candidate-additional-block__title">Personal details</div>
            <div className="detail-grid detail-grid--3">
              {personalEntries.map((entry) => (
                <div className="detail-item" key={entry.label}>
                  <div className="detail-item__label">{entry.label}</div>
                  <div className="detail-item__value">{entry.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {technicalSkills.length > 0 && (
          <div className="candidate-additional-block">
            <div className="candidate-additional-block__title">Technical skills</div>
            <div className="ta-chip-list">{technicalSkills.map((skill) => <span className="ta-chip" key={skill}>{skill}</span>)}</div>
          </div>
        )}

        {professionalSkills.length > 0 && (
          <div className="candidate-additional-block">
            <div className="candidate-additional-block__title">Professional skills</div>
            <div className="ta-chip-list">{professionalSkills.map((skill) => <span className="ta-chip" key={skill}>{skill}</span>)}</div>
          </div>
        )}

        <Qualifications value={record.qualifications} />

        {otherEntries.length > 0 && (
          <div className="candidate-additional-block">
            <div className="candidate-additional-block__title">Other details</div>
            <div className="detail-grid detail-grid--3">
              {otherEntries.map((entry) => (
                <div className="detail-item" key={entry.key}>
                  <div className="detail-item__label">{entry.label}</div>
                  <div className="detail-item__value">{entry.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
