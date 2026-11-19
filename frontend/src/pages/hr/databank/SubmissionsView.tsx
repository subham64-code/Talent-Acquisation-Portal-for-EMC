import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Download, Eye, FileText, Mail, Undo2, XCircle } from "lucide-react";
import DataTable, { type Column } from "../../../components/DataTable";
import Badge from "../../../components/ref/Badge";
import PageHeader from "../../../components/ref/PageHeader";
import Button from "../../../components/ref/Button";
import Modal from "../../../components/ref/Modal";
import DatabankToolbar from "./DatabankToolbar";
import { EmptyStateBlock, formatDateTime, initials } from "./shared";
import { hrApi } from "../../../lib/api";
import { useApiQuery, useInvalidate } from "../../../hooks/useApiQuery";

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Awaiting validation" },
  { value: "VALIDATED", label: "Validated" },
  { value: "REJECTED", label: "Rejected" },
];

const STATUS_META: Record<string, { label: string; variant: "green" | "orange" | "red" }> = {
  PENDING: { label: "Awaiting validation", variant: "orange" },
  VALIDATED: { label: "Validated", variant: "green" },
  REJECTED: { label: "Rejected", variant: "red" },
};

const FIELD_LABELS: Array<{ key: string; label: string; kind?: "date" | "number" }> = [
  { key: "fullName", label: "Full Name" },
  { key: "officialEmail", label: "Official Email" },
  { key: "personalEmail", label: "Personal Email" },
  { key: "mobile", label: "Contact Number" },
  { key: "departmentId", label: "Department" },
  { key: "designationId", label: "Designation" },
  { key: "employmentTypeId", label: "Employment Type" },
  { key: "joiningDate", label: "Joining Date", kind: "date" },
  { key: "workLocation", label: "Work Location" },
  { key: "qualification", label: "Qualification" },
  { key: "graduationYear", label: "Passing Year", kind: "number" },
  { key: "specialization", label: "Specialization" },
  { key: "totalExperience", label: "Total Experience (years)", kind: "number" },
  { key: "relevantExperience", label: "Relevant Experience (years)", kind: "number" },
  { key: "previousOrganization", label: "Previous Organization" },
  { key: "additionalInfo", label: "Additional Information" },
];

export default function SubmissionsView({ departments, designations, employmentTypes }: { departments: any[]; designations: any[]; employmentTypes: any[] }) {
  const invalidate = useInvalidate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [review, setReview] = useState<any>(null);
  const [reviewDetail, setReviewDetail] = useState<any>(null);
  const [rejecting, setRejecting] = useState(false);
  const [removeValidating, setRemoveValidating] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const departmentName = useMemo(() => Object.fromEntries(departments.map((d: any) => [d.id, d.name])), [departments]);
  const designationName = useMemo(() => Object.fromEntries(designations.map((d: any) => [d.id, d.name])), [designations]);
  const employmentTypeName = useMemo(() => Object.fromEntries(employmentTypes.map((d: any) => [d.id, d.name])), [employmentTypes]);

  const { data: submissions = [], isLoading } = useApiQuery<any[]>(
    ["employee-submissions", { search, status }],
    () => hrApi.employeeSubmissions({ search: search || undefined, status: status || undefined }).then((r: any) => r?.data?.submissions ?? []),
  );

  const pendingCount = submissions.filter((submission: any) => submission.status === "PENDING").length;
  const filtered = submissions.filter((submission: any) => !status || submission.status === status);

  useEffect(() => {
    if (!review?.id) {
      setReviewDetail(null);
      setRejecting(false);
      setRejectionReason("");
      return;
    }
    let cancelled = false;
    hrApi.employeeInvitation(review.id)
      .then((res: any) => { if (!cancelled) setReviewDetail(res?.data ?? res); })
      .catch((err: any) => { if (!cancelled) setError(err?.response?.data?.error?.message || "Could not load the submission details."); });
    return () => { cancelled = true; };
  }, [review?.id]);

  const clear = () => {
    setSearch("");
    setStatus("");
  };

  const validate = async (submission: any) => {
    setBusyId(submission.id);
    setError("");
    try {
      await hrApi.validateEmployeeSubmission(submission.id);
      setNotice(`${submission.employeeName}'s submission was validated and the employee record was updated.`);
      setReview(null);
      invalidate(["employee-submissions", "employees", "employee", "employee-invitations", "dashboard"]);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "The submission could not be validated.");
    } finally {
      setBusyId(null);
    }
  };

  const unvalidate = async (submission: any) => {
    if (!submission?.id) return;
    setBusyId(submission.id);
    setError("");
    try {
      await hrApi.unvalidateEmployeeSubmission(submission.id);
      setNotice(`Validation removed for ${submission.employeeName}. The submission is back in the validation queue and the previous record was restored.`);
      setRemoveValidating(null);
      setReview(null);
      invalidate(["employee-submissions", "employees", "employee", "employee-invitations", "dashboard"]);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Validation could not be removed.");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (submission: any) => {
    setBusyId(submission.id);
    setError("");
    try {
      await hrApi.rejectEmployeeSubmission(submission.id, rejectionReason.trim() || undefined);
      setNotice(`${submission.employeeName}'s submission was rejected. The invitation was reopened for correction.`);
      setReview(null);
      invalidate(["employee-submissions", "employee-invitations", "dashboard"]);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "The submission could not be rejected.");
    } finally {
      setBusyId(null);
    }
  };

  const columns: Column<any>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (submission) => (
        <div className="cell-user">
          <div className="avatar">{initials(submission.employeeName)}</div>
          <div className="cell-user__text"><div className="cell-user__name">{submission.employeeName}</div><div className="cell-user__sub">{submission.email}</div></div>
        </div>
      ),
    },
    { key: "submitted", header: "Submission Date", render: (submission) => <span className="cell-muted">{formatDateTime(submission.submittedAt)}</span> },
    {
      key: "completion",
      header: "Profile Completion",
      render: (submission) => (
        <div className="mini-progress"><div className="mini-progress__track"><div className="mini-progress__bar" style={{ width: `${submission.completion}%` }} /></div><span>{submission.completion}%</span></div>
      ),
    },
    { key: "cv", header: "CV Status", render: (submission) => <Badge variant={submission.hasCv ? "green" : "grey"}>{submission.hasCv ? "CV attached" : "No CV"}</Badge> },
    {
      key: "status",
      header: "Submission Status",
      render: (submission) => {
        const meta = STATUS_META[submission.status] ?? STATUS_META.PENDING;
        return <Badge variant={meta.variant} dot>{meta.label}</Badge>;
      },
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (submission) => (
        <div className="cell-actions">
          <Button variant="ghost" size="sm" icon={Eye} onClick={() => setReview(submission)} type="button">Review</Button>
          {submission.status === "PENDING" && (
            <>
              <Button variant="outline" size="sm" icon={CheckCircle2} onClick={() => validate(submission)} loading={busyId === submission.id} type="button">Validate</Button>
              <Button variant="danger-ghost" size="sm" icon={XCircle} onClick={() => { setReview(submission); setRejecting(true); }} type="button">Reject</Button>
            </>
          )}
          {submission.status === "VALIDATED" && (
            <Button variant="danger-ghost" size="sm" icon={Undo2} onClick={() => setRemoveValidating(submission)} type="button">Remove validation</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Employee databank / submissions"
        title="Employee Submissions"
        subtitle="Review profiles completed through employee self-service. Validation creates or updates a single current employee record and prevents duplicate people."
      />

      <div className="notice notice--info">
        <span className="notice__icon"><CheckCircle2 size={18} aria-hidden="true" /></span>
        <div className="notice__body"><div className="notice__title">{pendingCount} submission{pendingCount === 1 ? "" : "s"} awaiting HR validation</div>Open a submission to inspect the full profile and CV. A confirmation is required before saving a validated employee record. If a submission was validated by mistake, use "Remove validation" to revert it.</div>
      </div>

      {notice && <div className="notice notice--success" role="status"><div className="notice__body">{notice}</div></div>}
      {error && <div className="notice notice--error" role="alert"><div className="notice__body">{error}</div></div>}

      <DatabankToolbar
        search={search}
        onSearch={setSearch}
        searchLabel="Search submissions"
        searchPlaceholder="Search submissions by employee name or email…"
        filters={[{ key: "status", label: "Statuses", placeholder: "All Statuses", value: status, onChange: setStatus, options: STATUS_OPTIONS }]}
        onClear={clear}
      >
        <span className="filters-summary">{isLoading ? "Loading submissions…" : `${filtered.length} submission${filtered.length === 1 ? "" : "s"}`}</span>
      </DatabankToolbar>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        loading={isLoading}
        empty={<EmptyStateBlock icon={FileText} title="No submissions match this view" description="Employee self-service submissions will appear here after they complete their profile." />}
        footer={<><span>Showing <strong>{filtered.length}</strong> submission{filtered.length === 1 ? "" : "s"}</span><span className="cell-muted">Validate to update the current employee record</span></>}
      />

      <Modal
        open={Boolean(review)}
        onClose={() => setReview(null)}
        title="Review Submission"
        subtitle={review ? `${review.employeeName} · ${review.email}` : undefined}
        size="xl"
        footer={review ? (
          <>
            <Button variant="outline" onClick={() => setReview(null)}>Close</Button>
            {review.status === "VALIDATED" && (
              <Button variant="danger-ghost" icon={Undo2} onClick={() => setRemoveValidating(review)}>Remove validation</Button>
            )}
            {review.status === "PENDING" && !rejecting && (
              <>
                <Button variant="danger-ghost" icon={XCircle} onClick={() => setRejecting(true)}>Reject</Button>
                <Button icon={CheckCircle2} onClick={() => validate(review)} loading={busyId === review.id}>Validate Submission</Button>
              </>
            )}
            {review.status === "PENDING" && rejecting && (
              <>
                <Button variant="outline" onClick={() => setRejecting(false)} disabled={busyId === review.id}>Back</Button>
                <Button variant="danger" icon={XCircle} onClick={() => reject(review)} loading={busyId === review.id}>Confirm Rejection</Button>
              </>
            )}
          </>
        ) : undefined}
      >
        {review && (
          <div className="submission-summary">
            <div className="avatar avatar--lg">{initials(review.employeeName)}</div>
            <div className="submission-summary__identity">
              <h3 className="submission-summary__name">{review.employeeName}</h3>
              <div className="submission-summary__meta">
                <span><Mail size={13} aria-hidden="true" /> {review.email}</span>
                <span><CalendarClock size={13} aria-hidden="true" /> Submitted {formatDateTime(review.submittedAt)}</span>
              </div>
              <div className="submission-summary__badges">
                {(() => { const meta = STATUS_META[review.status] ?? STATUS_META.PENDING; return <Badge variant={meta.variant} dot>{meta.label}</Badge>; })()}
                <Badge variant={review.hasCv ? "green" : "grey"}>{review.hasCv ? "CV attached" : "No CV"}</Badge>
              </div>
            </div>
            <div className="submission-summary__completion">
              <div className="submission-summary__completion-value">{review.completion}%</div>
              <div className="submission-summary__completion-label">Profile completion</div>
              <div className="mini-progress"><div className="mini-progress__track"><div className="mini-progress__bar" style={{ width: `${review.completion}%` }} /></div></div>
            </div>
          </div>
        )}

        {review && rejecting && (
          <div className="field" style={{ marginTop: "1rem" }}>
            <label className="field__label" htmlFor="rejection-reason">Reason for rejection <span className="field__optional">(optional)</span></label>
            <textarea id="rejection-reason" className="textarea" rows={3} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Tell the employee what to correct before resubmitting…" />
          </div>
        )}

        {review?.status === "REJECTED" && review.reason && (
          <div className="notice notice--error" style={{ marginTop: "1rem" }}><div className="notice__body"><div className="notice__title">Rejection reason</div>{review.reason}</div></div>
        )}

        {review && (
          <div className="card" style={{ marginTop: "1rem" }}>
            <div className="card__body">
              <div className="detail-grid detail-grid--3">
                {FIELD_LABELS.map((field) => {
                  const value = review.fields?.[field.key];
                  if (value === undefined || value === null || value === "") return null;
                  let display: string = String(value);
                  if (field.key === "departmentId") display = departmentName[value] || value;
                  else if (field.key === "designationId") display = designationName[value] || value;
                  else if (field.key === "employmentTypeId") display = employmentTypeName[value] || value;
                  else if (field.kind === "date" && !Number.isNaN(new Date(String(value)).getTime())) display = new Date(String(value)).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
                  return (
                    <div className="detail-item" key={field.key}>
                      <div className="detail-item__label">{field.label}</div>
                      <div className="detail-item__value">{display}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {review?.hasCv && (
          <div className="card" style={{ marginTop: "1rem" }}>
            <div className="card__header"><div><div className="card__title">Submitted CV</div><div className="card__subtitle">The document attached to this submission.</div></div></div>
            <div className="card__body"><SubmissionCV invitationId={review.id} /></div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(removeValidating)}
        onClose={() => (busyId ? undefined : setRemoveValidating(null))}
        title="Remove validation"
        size="sm"
        footer={(
          <>
            <Button variant="outline" onClick={() => setRemoveValidating(null)} disabled={Boolean(busyId)}>Cancel</Button>
            <Button variant="danger-ghost" icon={Undo2} onClick={() => removeValidating && void unvalidate(removeValidating)} loading={busyId === removeValidating?.id}>Remove validation</Button>
          </>
        )}
      >
        <p>This will set <strong>{removeValidating?.employeeName ?? "this submission"}</strong> back to <strong>awaiting validation</strong>.</p>
        <p>If the submission was validated after this feature was added, the employee record and CV link will be restored to their pre-validation state. The submission is kept and can be validated again once corrected.</p>
      </Modal>
    </div>
  );
}

function SubmissionCV({ invitationId }: { invitationId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const openFile = async (download: boolean) => {
    setBusy(true);
    setError("");
    try {
      const detail = await hrApi.employeeInvitation(invitationId).then((r: any) => r?.data ?? r);
      const fileId = detail?.submission?.fileId;
      if (!fileId) throw new Error("No CV file id for this submission.");
      const tokenRes = await hrApi.fileAccessToken(fileId);
      const token = tokenRes?.data?.token;
      const blobRes = await hrApi.file(fileId, token);
      const objectUrl = URL.createObjectURL(blobRes.data as Blob);
      if (download) {
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = "submitted-cv";
        link.click();
        URL.revokeObjectURL(objectUrl);
      } else {
        if (url) URL.revokeObjectURL(url);
        setUrl(objectUrl);
        setOpen(true);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || "The CV could not be opened.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  return (
    <div>
      <div className="cv-file">
        <span className="cv-file__icon"><FileText size={22} aria-hidden="true" /></span>
        <div className="cv-file__info"><div className="cv-file__name">Submitted CV</div><div className="cv-file__meta">Attached to this submission · not applied to the employee record yet</div></div>
        <div className="cv-file__actions">
          <button type="button" className="btn btn--ghost btn--icon" onClick={() => void openFile(false)} disabled={busy} title="Preview CV" aria-label="Preview CV"><Eye size={16} /></button>
          <button type="button" className="btn btn--ghost btn--icon" onClick={() => void openFile(true)} disabled={busy} title="Download CV" aria-label="Download CV"><Download size={16} /></button>
        </div>
      </div>
      {error && <div className="notice notice--error" role="alert" style={{ marginTop: "0.75rem" }}><div className="notice__body">{error}</div></div>}
      {open && url && <iframe title="Submitted CV preview" src={url} style={{ width: "100%", height: 420, border: 0, marginTop: "0.75rem" }} />}
    </div>
  );
}
