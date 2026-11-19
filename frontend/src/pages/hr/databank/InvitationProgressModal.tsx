import { useEffect, useState } from "react";
import { CheckCircle2, Circle, FileText, ListChecks } from "lucide-react";
import Modal from "../../../components/ref/Modal";
import Button from "../../../components/ref/Button";
import Badge from "../../../components/ref/Badge";
import { hrApi } from "../../../lib/api";
import { formatDateTime, relativeDay } from "./shared";

const REQUIRED_FIELDS: Array<{ key: string; label: string }> = [
  { key: "fullName", label: "Full name" },
  { key: "personalEmail", label: "Personal email" },
  { key: "mobile", label: "Contact number" },
  { key: "departmentId", label: "Department" },
  { key: "designationId", label: "Designation" },
  { key: "qualification", label: "Qualification" },
  { key: "totalExperience", label: "Total years of experience" },
  { key: "specialization", label: "Specialization" },
  { key: "employmentTypeId", label: "Employment type" },
  { key: "workLocation", label: "Work location" },
];

export default function InvitationProgressModal({ invitation, onClose }: { invitation: any | null; onClose: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!invitation?.id) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    setError("");
    hrApi.employeeInvitation(invitation.id)
      .then((res: any) => { if (!cancelled) setDetail(res?.data ?? res); })
      .catch((err: any) => { if (!cancelled) setError(err?.response?.data?.error?.message || "Could not load the invitation progress."); });
    return () => { cancelled = true; };
  }, [invitation?.id]);

  const open = Boolean(invitation);
  const fields = detail?.submission?.fields ?? detail?.draft ?? null;
  const completion = invitation?.completion ?? (fields ? Math.round((REQUIRED_FIELDS.filter(({ key }) => String(fields?.[key] ?? "").trim()).length / REQUIRED_FIELDS.length) * 100) : 0);
  const hasCv = Boolean(detail?.submission?.fileId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Profile Progress"
      subtitle={invitation?.email}
      size="md"
      footer={<Button variant="outline" onClick={onClose}>Close</Button>}
    >
      {invitation && (
        <div className="invitation-progress">
          {error && <div className="notice notice--error" role="alert"><div className="notice__body">{error}</div></div>}
          <div className="form-progress">
            <div className="form-progress__head"><span>Profile completeness</span><strong>{completion}%</strong></div>
            <div className="form-progress__track" role="progressbar" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100}><div className="form-progress__bar" style={{ width: `${completion}%` }} /></div>
          </div>
          <div className="progress-summary">
            <span><strong>{REQUIRED_FIELDS.filter(({ key }) => String(fields?.[key] ?? "").trim()).length}</strong> of <strong>{REQUIRED_FIELDS.length}</strong> required fields completed</span>
            <Badge variant={hasCv ? "green" : "grey"}><FileText size={12} aria-hidden="true" /> {hasCv ? "CV attached" : "No CV yet"}</Badge>
          </div>
          <div className="detail-section">
            <div className="detail-section__title"><ListChecks size={16} aria-hidden="true" /> Required fields</div>
            <ul className="progress-checklist">
              {REQUIRED_FIELDS.map((field) => {
                const complete = Boolean(String(fields?.[field.key] ?? "").trim());
                return (
                  <li key={field.key} className={`progress-checklist__item ${complete ? "progress-checklist__item--done" : ""}`}>
                    {complete ? <CheckCircle2 size={15} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}
                    <span>{field.label}</span>
                    <span className="progress-checklist__state">{complete ? "Completed" : "Not completed"}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="progress-meta">
            <span>Last draft saved: <strong>{invitation.draftUpdatedAt ? formatDateTime(invitation.draftUpdatedAt) : "No saved draft yet"}</strong></span>
            {invitation.lastReminderSentAt && <span>Last reminder: <strong>{formatDateTime(invitation.lastReminderSentAt)} · {relativeDay(invitation.lastReminderSentAt)}</strong></span>}
            <span>Invitation link: <strong>Never expires</strong></span>
          </div>
        </div>
      )}
    </Modal>
  );
}
