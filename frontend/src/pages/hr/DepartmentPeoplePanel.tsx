import { FileText, MapPin, Mail, Phone, UserRound, X } from "lucide-react";
import { Link } from "react-router-dom";
import Badge from "../../components/ref/Badge";
import CandidateStatusBadge from "../../components/ref/CandidateStatusBadge";
import { hrApi } from "../../lib/api";
import { useApiQuery } from "../../hooks/useApiQuery";
import { EmptyStateBlock, formatDate, formatDateTime, initials } from "./databank/shared";

export default function DepartmentPeoplePanel({ department, onClear }: {
  department: { id: string; name: string } | null;
  onClear: () => void;
}) {
  const { data: applications = [], isLoading, error } = useApiQuery<any[]>(
    ["applications", "department-panel", department?.id],
    () => department
      ? hrApi.applications({ page: 1, pageSize: 500, departmentId: department.id }).then((r: any) => r?.data?.items ?? [])
      : Promise.resolve<any[]>([]),
  );

  const openCv = async (fileId?: string) => {
    if (!fileId) return;
    try {
      const res = await hrApi.fileAccessToken(fileId);
      const directUrl = res?.data?.url;
      const token = res?.data?.token;
      if (directUrl) {
        window.open(directUrl, "_blank", "noreferrer");
        return;
      }
      if (token) window.open(`/api/v1/files/${fileId}?token=${token}`, "_blank", "noreferrer");
    } catch {
      // File access is already scoped to HR users; ignore failures in the preview button.
    }
  };

  if (!department) return null;

  return (
    <section className="card" id="department-people">
      <div className="card__header">
        <div>
          <div className="card__title">{department.name}: People in the pipeline</div>
          <div className="card__subtitle">Candidates who applied to openings under this department, with their complete submitted information.</div>
        </div>
        <div className="card__header-actions">
          <Badge variant="blue">{applications.length} {applications.length === 1 ? "candidate" : "candidates"}</Badge>
          <button type="button" className="btn btn--ghost btn--icon" onClick={onClear} aria-label="Clear department selection" title="Clear department selection"><X size={16} /></button>
        </div>
      </div>
      <div className="card__body">
        {isLoading ? (
          <div className="loading-block"><div className="spinner" /> Loading the department pipeline…</div>
        ) : applications.length === 0 ? (
          <EmptyStateBlock icon={MapPin} title="No candidates in this department yet" description="Applications for openings in this department will appear here." />
        ) : error ? (
          <div className="notice notice--error" role="alert"><div className="notice__body">Could not load the department people.</div></div>
        ) : (
          <div className="department-people">
            {applications.map((application: any) => {
              const candidate = application.candidate ?? {};
              const job = application.jobOpening ?? {};
              const skills = candidate.skills ?? [];
              const cvFileId = application.resumeFile?.id ?? application.resumeFileId;
              return (
                <article className="department-person" key={application.id}>
                  <div className="department-person__header">
                    <div className="cell-user">
                      <div className="avatar avatar--lg">{initials(candidate.fullName || "Candidate")}</div>
                      <div className="cell-user__text">
                        <div className="cell-user__name">{candidate.fullName || "Candidate"}</div>
                        <div className="cell-user__sub">{candidate.candidateCode || "No candidate ID"} · {candidate.email}</div>
                      </div>
                    </div>
                    <div className="department-person__actions">
                      <CandidateStatusBadge status={application.status} />
                      {cvFileId && <button type="button" className="btn btn--outline btn--sm" onClick={() => void openCv(cvFileId)}><FileText size={14} aria-hidden="true" /> Preview CV</button>}
                      <Link className="btn btn--primary btn--sm" to={`/hr/submissions/${application.id}`}>Open full profile</Link>
                    </div>
                  </div>

                  <div className="detail-grid detail-grid--4">
                    <div className="detail-item"><div className="detail-item__label">Application ID</div><div className="detail-item__value">{application.applicationCode}</div></div>
                    <div className="detail-item"><div className="detail-item__label">Position</div><div className="detail-item__value">{job.title || "—"}</div></div>
                    <div className="detail-item"><div className="detail-item__label">Applied</div><div className="detail-item__value">{formatDate(application.appliedAt)}</div></div>
                    <div className="detail-item"><div className="detail-item__label">Source</div><div className="detail-item__value">{application.source || "Career Portal"}</div></div>
                    <div className="detail-item"><div className="detail-item__label"><Mail size={11} aria-hidden="true" /> Email</div><div className="detail-item__value">{candidate.email || "—"}</div></div>
                    <div className="detail-item"><div className="detail-item__label"><Phone size={11} aria-hidden="true" /> Phone</div><div className="detail-item__value">{candidate.mobile || "—"}</div></div>
                    <div className="detail-item"><div className="detail-item__label"><MapPin size={11} aria-hidden="true" /> Location</div><div className="detail-item__value">{candidate.currentLocation || "—"}</div></div>
                    <div className="detail-item"><div className="detail-item__label">Current designation</div><div className="detail-item__value">{candidate.currentDesignation || "Not provided"}</div></div>
                    <div className="detail-item"><div className="detail-item__label">Current company</div><div className="detail-item__value">{candidate.currentOrganization || "Not provided"}</div></div>
                    <div className="detail-item"><div className="detail-item__label">Qualification</div><div className="detail-item__value">{candidate.qualification || "Not provided"}{candidate.graduationYear ? ` · ${candidate.graduationYear}` : ""}</div></div>
                    <div className="detail-item"><div className="detail-item__label">Specialization</div><div className="detail-item__value">{candidate.specialization || "—"}</div></div>
                    <div className="detail-item"><div className="detail-item__label">Experience</div><div className="detail-item__value">{candidate.totalExperience ?? 0} yrs total · {candidate.relevantExperience ?? 0} yrs relevant</div></div>
                    <div className="detail-item"><div className="detail-item__label">AI match score</div><div className="detail-item__value">{application.aiMatchScore != null ? `${Math.round(application.aiMatchScore)}%` : "—"}</div></div>
                    <div className="detail-item"><div className="detail-item__label">Offered salary</div><div className="detail-item__value">{application.finalSelectionSalary != null ? `₹${Number(application.finalSelectionSalary).toLocaleString("en-IN")}` : "—"}</div></div>
                    <div className="detail-item"><div className="detail-item__label">Expected salary</div><div className="detail-item__value">{application.finalSelectionExpectedSalary != null ? `₹${Number(application.finalSelectionExpectedSalary).toLocaleString("en-IN")}` : "—"}</div></div>
                    <div className="detail-item"><div className="detail-item__label">HR remarks</div><div className="detail-item__value">{application.hrRemarks || "No remarks recorded"}</div></div>
                  </div>

                  {skills.length > 0 && (
                    <div className="department-person__block">
                      <div className="department-person__block-title">Skills</div>
                      <div className="ta-chip-list">{skills.map((record: any) => <span className="ta-chip" key={record.id || record.skill?.name || record}>{record.skill?.name || String(record)}</span>)}</div>
                    </div>
                  )}

                  <div className="department-person__columns">
                    <div className="department-person__block">
                      <div className="department-person__block-title">Education</div>
                      {candidate.education?.length ? (
                        <ul className="ta-detail-list">{candidate.education.map((item: any) => <li className="ta-detail-list__item" key={item.id}><div className="ta-detail-list__title">{item.degree}</div><div className="ta-detail-list__meta">{item.institution}{item.field ? ` · ${item.field}` : ""}{item.endYear ? ` · ${item.endYear}` : ""}</div></li>)}</ul>
                      ) : <p className="detail-item__value detail-item__value--muted">No education details provided.</p>}
                    </div>
                    <div className="department-person__block">
                      <div className="department-person__block-title">Professional experience</div>
                      {candidate.employmentHistory?.length ? (
                        <ul className="ta-detail-list">{candidate.employmentHistory.map((item: any) => <li className="ta-detail-list__item" key={item.id}><div className="ta-detail-list__title">{item.title || "Role"} · {item.organization}</div><div className="ta-detail-list__meta">{item.startDate ? new Date(item.startDate).getFullYear() : ""}{item.endDate ? ` → ${new Date(item.endDate).getFullYear()}` : " → Present"}{item.description ? ` · ${item.description}` : ""}</div></li>)}</ul>
                      ) : <p className="detail-item__value detail-item__value--muted">No experience details provided.</p>}
                    </div>
                    <div className="department-person__block">
                      <div className="department-person__block-title">Certifications</div>
                      {candidate.certifications?.length ? (
                        <ul className="ta-detail-list">{candidate.certifications.map((item: any) => <li className="ta-detail-list__item" key={item.id}><div className="ta-detail-list__title">{item.name}</div><div className="ta-detail-list__meta">{item.issuer}{item.issuedAt ? ` · ${new Date(item.issuedAt).getFullYear()}` : ""}</div></li>)}</ul>
                      ) : <p className="detail-item__value detail-item__value--muted">No certifications provided.</p>}
                    </div>
                  </div>

                  {application.coverLetter && <div className="department-person__block"><div className="department-person__block-title">Cover letter</div><p className="department-person__prose">{application.coverLetter}</p></div>}
                  {application.finalSelectionNote && <div className="department-person__block"><div className="department-person__block-title">Final selection note</div><p className="department-person__prose">{application.finalSelectionNote}</p></div>}
                  <div className="department-person__footer"><span><UserRound size={12} aria-hidden="true" /> Candidate ID: {candidate.candidateCode || "—"}</span><span>Submitted {formatDateTime(application.appliedAt)}</span></div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
