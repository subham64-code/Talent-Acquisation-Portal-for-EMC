import { useEffect, useMemo, useState } from "react";
import { BellRing, Copy, Download, ExternalLink, Eye, FileSearch, Mail, RefreshCw, Send, Trash2 } from "lucide-react";
import DataTable, { type Column } from "../../../components/DataTable";
import Badge from "../../../components/ref/Badge";
import PageHeader from "../../../components/ref/PageHeader";
import Button from "../../../components/ref/Button";
import Modal from "../../../components/ref/Modal";
import DatabankToolbar from "./DatabankToolbar";
import InvitationProgressModal from "./InvitationProgressModal";
import { formatDate, formatDateTime, initials } from "./shared";
import { hrApi } from "../../../lib/api";
import { useApiQuery, useInvalidate } from "../../../hooks/useApiQuery";

const STATUS_OPTIONS = [
  { value: "SENT", label: "Pending" },
  { value: "OPENED", label: "Opened" },
  { value: "DRAFT", label: "In Progress" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "VALIDATED", label: "Validated" },
  { value: "REJECTED", label: "Rejected" },
];

const COMPLETION_OPTIONS = [
  { value: "not_started", label: "Not started (0%)" },
  { value: "in_progress", label: "In progress (1–99%)" },
  { value: "complete", label: "Complete (100%)" },
];

const DATE_OPTIONS = [
  { value: "7", label: "Invited in last 7 days" },
  { value: "30", label: "Invited in last 30 days" },
  { value: "90", label: "Invited in last 90 days" },
];

const SUBMISSION_FIELDS: Array<{ key: string; label: string; kind?: "date" | "number" | "text" }> = [
  { key: "fullName", label: "Full Name" },
  { key: "officialEmail", label: "Official Email" },
  { key: "personalEmail", label: "Personal Email" },
  { key: "mobile", label: "Mobile Number" },
  { key: "departmentId", label: "Department" },
  { key: "designationId", label: "Designation" },
  { key: "employmentTypeId", label: "Employment Type" },
  { key: "joiningDate", label: "Joining Date", kind: "date" },
  { key: "workLocation", label: "Work Location" },
  { key: "qualification", label: "Qualification" },
  { key: "graduationYear", label: "Graduation Year", kind: "number" },
  { key: "specialization", label: "Specialization" },
  { key: "totalExperience", label: "Total Experience (years)", kind: "number" },
  { key: "relevantExperience", label: "Relevant Experience (years)", kind: "number" },
  { key: "previousOrganization", label: "Previous Organization" },
  { key: "additionalInfo", label: "Additional Information" },
];

const STATUS_VARIANT: Record<string, { label: string; variant: "green" | "orange" | "blue" | "red" | "grey" }> = {
  SENT: { label: "Pending", variant: "orange" },
  OPENED: { label: "Opened", variant: "blue" },
  DRAFT: { label: "In Progress", variant: "blue" },
  SUBMITTED: { label: "Submitted", variant: "green" },
  VALIDATED: { label: "Validated", variant: "green" },
  REJECTED: { label: "Rejected", variant: "red" },
};

type InviteAction = "resend" | "renew" | "remind" | "remind_submit" | "details";

const actionFor = (inv: any): InviteAction => {
  if (!inv) return "details";
  if (inv.status === "SUBMITTED" || inv.status === "VALIDATED" || inv.status === "REJECTED") return "details";
  if (inv.completion >= 100) return "remind_submit";
  if (inv.completion > 0) return "remind";
  return "resend";
};

export default function InvitationsView() {
  const invalidate = useInvalidate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [completion, setCompletion] = useState("");
  const [date, setDate] = useState("");
  const [viewing, setViewing] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [removing, setRemoving] = useState<any>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [linkResult, setLinkResult] = useState<{ id: string; link: string } | null>(null);
  const [error, setError] = useState("");

  const { data: invitations = [], isLoading } = useApiQuery<any[]>(
    ["employee-invitations", { search, status, completion, date }],
    () =>
      hrApi.employeeInvitationList({ search: search || undefined, status: status || undefined, completion: completion || undefined, date: date || undefined })
        .then((r: any) => r?.data?.invitations ?? []),
  );
  const { data: departments = [] } = useApiQuery<any[]>(["departments", "dropdown"], () => hrApi.departmentDropdown().then((r: any) => r?.data?.items ?? r?.data ?? []));
  const { data: designations = [] } = useApiQuery<any[]>(["designations", "all"], () => hrApi.designations({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? []));
  const { data: employmentTypes = [] } = useApiQuery<any[]>(["employment-types", "all"], () => hrApi.employmentTypes({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? []));

  const filtered = invitations;
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (!viewing?.id) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    setDetailLoading(true);
    hrApi.employeeInvitation(viewing.id)
      .then((r: any) => { if (!cancelled) setDetail(r?.data ?? r); })
      .catch((err: any) => { if (!cancelled) setError(err?.response?.data?.error?.message || "Could not load the invitation details."); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [viewing?.id]);

  const departmentName = useMemo(() => Object.fromEntries(departments.map((d: any) => [d.id, d.name])), [departments]);
  const designationName = useMemo(() => Object.fromEntries(designations.map((d: any) => [d.id, d.name])), [designations]);
  const employmentTypeName = useMemo(() => Object.fromEntries(employmentTypes.map((d: any) => [d.id, d.name])), [employmentTypes]);

  const resolveField = (key: string, value: any) => {
    if (key === "departmentId") return departmentName[value] || value || null;
    if (key === "designationId") return designationName[value] || value || null;
    if (key === "employmentTypeId") return employmentTypeName[value] || value || null;
    if (key === "joiningDate" && value && !Number.isNaN(new Date(String(value)).getTime())) {
      return new Date(String(value)).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    }
    return value === "" || value === undefined ? null : String(value);
  };

  const openCv = async (fileId: string) => {
    setPreviewing(true);
    setError("");
    try {
      const tokenRes = await hrApi.fileAccessToken(fileId);
      const token = tokenRes?.data?.token;
      if (token) {
        const blobRes = await hrApi.file(fileId, token);
        const url = URL.createObjectURL(blobRes.data as Blob);
        if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(url);
      } else if (tokenRes?.data?.url) {
        setPreviewUrl(tokenRes.data.url);
      } else {
        throw new Error("Could not open the CV.");
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || "Could not open the CV.");
    } finally {
      setPreviewing(false);
    }
  };

  const clear = () => {
    setSearch("");
    setStatus("");
    setCompletion("");
    setDate("");
  };

  const act = async (invitation: any, action: InviteAction) => {
    setBusyId(invitation.id);
    setError("");
    setNotice("");
    setLinkResult(null);
    try {
      if (action === "resend") {
        const res = await hrApi.resendEmployeeInvitation(invitation.id);
        const link = res?.data?.link;
        setNotice(`Invitation resent to ${invitation.email}. A fresh link was emailed (any previous links no longer work).`);
        if (link) setLinkResult({ id: invitation.id, link });
      } else if (action === "renew") {
        const res = await hrApi.renewEmployeeInvitation(invitation.id);
        const link = res?.data?.link;
        setNotice(`Invitation renewed for ${invitation.email}. The previous link is no longer valid.`);
        if (link) setLinkResult({ id: invitation.id, link });
      } else if (action === "remind") {
        const res = await hrApi.remindEmployeeInvitation(invitation.id, "reminder");
        const link = res?.data?.link;
        setNotice(`Reminder sent to ${invitation.email} with a fresh invitation link.`);
        if (link) setLinkResult({ id: invitation.id, link });
      } else if (action === "remind_submit") {
        const res = await hrApi.remindEmployeeInvitation(invitation.id, "submit");
        const link = res?.data?.link;
        setNotice(`Submission reminder sent to ${invitation.email} with a fresh invitation link.`);
        if (link) setLinkResult({ id: invitation.id, link });
      }
      invalidate(["employee-invitations"]);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "The invitation action could not be completed.");
    } finally {
      setBusyId(null);
    }
  };

  const copyLink = async (invitation: any) => {
    setBusyId(invitation.id);
    setError("");
    try {
      // The raw token is never stored, so a copy always issues a fresh link.
      const res = await hrApi.generateEmployeeInvitationLink(invitation.id);
      const link = res?.data?.link;
      if (!link) throw new Error("No link returned by the server.");
      await navigator.clipboard.writeText(link);
      setLinkResult({ id: invitation.id, link });
      setNotice("A fresh invitation link was generated and copied to the clipboard.");
      invalidate(["employee-invitations"]);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Could not copy the invitation link.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setRemoveLoading(true);
    setError("");
    try {
      await hrApi.removeEmployeeInvitation(removing.id);
      setNotice(`Invitation removed for ${removing.email}.`);
      setRemoving(null);
      invalidate(["employee-invitations", "employees", "dashboard"]);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Could not remove the invitation.");
    } finally {
      setRemoveLoading(false);
    }
  };

  const columns: Column<any>[] = [
    {
      key: "employee",
      header: "Employee Name",
      render: (inv) => (
        <div className="cell-user">
          <div className="avatar">{inv.fullName ? initials(inv.fullName) : <Mail size={16} aria-hidden="true" />}</div>
          <div className="cell-user__text"><div className="cell-user__name">{inv.fullName || "Employee invitation"}</div><div className="cell-user__sub">{inv.employeeCode}</div></div>
        </div>
      ),
    },
    { key: "email", header: "Email", render: (inv) => <div className="cell-email" title={inv.email}>{inv.email}</div> },
    {
      key: "sentAt",
      header: "Sent Date",
      render: (inv) => (
        <div>
          <div>{formatDate(inv.initialSentAt)}</div>
          <div className="cell-muted">Link never expires</div>
        </div>
      ),
    },
    {
      key: "completion",
      header: "Profile Completion",
      render: (inv) => (
        <button type="button" className="mini-progress mini-progress--button" onClick={() => setProgress(inv)} title="View profile progress" aria-label={`View profile progress for ${inv.email}`}>
          <span className="mini-progress__track"><span className="mini-progress__bar" style={{ width: `${inv.completion}%` }} /></span>
          <span>{inv.completion}%</span>
        </button>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (inv) => {
        const meta = STATUS_VARIANT[inv.status] ?? { label: inv.status, variant: "grey" as const };
        return <Badge variant={meta.variant} dot>{meta.label}</Badge>;
      },
    },
    {
      key: "reminder",
      header: "Last Reminder Sent",
      render: (inv) => (
        <div>
          <div>{inv.lastReminderSentAt ? formatDate(inv.lastReminderSentAt) : "—"}</div>
          <div className="cell-muted">{inv.reminderCount ? `${inv.reminderCount} reminder${inv.reminderCount === 1 ? "" : "s"}` : "No reminders yet"}</div>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-center",
      render: (inv) => {
        const action = actionFor(inv);
        const busy = busyId === inv.id;
        return (
          <div className="cell-actions" style={{ justifyContent: "center", gap: 8, width: "100%", flexWrap: "nowrap", whiteSpace: "nowrap" }}>
            <Button variant="ghost" size="sm" icon={Eye} onClick={() => setViewing(inv)} type="button">Details</Button>
            <button type="button" className="btn btn--ghost btn--icon" onClick={() => copyLink(inv)} disabled={busy} title="Copy a fresh invitation link" aria-label={`Copy invitation link for ${inv.email}`}>
              {busy ? <RefreshCw size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            </button>
            {action !== "details" && (
              <Button
                variant="outline"
                size="sm"
                icon={action === "resend" || action === "renew" ? RefreshCw : BellRing}
                onClick={() => act(inv, action)}
                loading={busy}
                disabled={Boolean(busyId) && !busy}
                title={action === "resend" ? "Resend invitation" : action === "renew" ? "Renew and resend" : "Send reminder"}
                type="button"
              >
                {action === "resend" ? "Resend" : action === "renew" ? "Renew" : "Remind"}
              </Button>
            )}
            <button type="button" className="btn btn--danger-ghost btn--icon" onClick={() => setRemoving(inv)} disabled={busy} title="Remove invitation" aria-label={`Remove invitation for ${inv.email}`}>
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        );
      },
    },
  ];

  const fields = (detail?.submission?.fields ?? detail?.draft ?? null) as any;
  const fieldEntries = SUBMISSION_FIELDS
    .map(({ key, label }) => ({ key, label, value: resolveField(key, fields?.[key]) }))
    .filter((entry) => Boolean(entry.value));
  const hasDetails = Boolean(fieldEntries.length > 0 || detail?.submission?.fileId);
  const cvFileId = detail?.submission?.fileId ?? null;

  return (
    <div>
      <PageHeader
        eyebrow="Employee databank / invitations"
        title="Invitations"
        subtitle="Track profile completion, reminder history, and invitation status. Invitation emails are sent through the configured provider."
      />

      {notice && <div className="notice notice--success" role="status"><div className="notice__body">{notice}{linkResult && <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}><input className="input" style={{ maxWidth: 420 }} value={linkResult.link} readOnly onFocus={(e) => e.target.select()} /><a className="btn btn--outline btn--sm" href={linkResult.link} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open</a></div>}</div></div>}
      {error && <div className="notice notice--error" role="alert"><div className="notice__body">{error}</div></div>}

      <DatabankToolbar
        search={search}
        onSearch={setSearch}
        searchLabel="Search invitations"
        searchPlaceholder="Search invitations by employee email or name…"
        filters={[
          { key: "status", label: "Statuses", placeholder: "All Statuses", value: status, onChange: setStatus, options: STATUS_OPTIONS },
          { key: "completion", label: "Profile completion", placeholder: "All Completion Levels", value: completion, onChange: setCompletion, options: COMPLETION_OPTIONS },
          { key: "date", label: "Invitation date", placeholder: "Any Invitation Date", value: date, onChange: setDate, options: DATE_OPTIONS },
        ]}
        onClear={clear}
      >
        <span className="filters-summary">{isLoading ? "Loading invitations…" : `${filtered.length} invitation${filtered.length === 1 ? "" : "s"}`}</span>
      </DatabankToolbar>

      <div className="table-wrapper" style={{ overflowX: "auto" }}><DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        loading={isLoading}
        empty={
          <div className="empty-state"><span className="empty-state__icon"><Send size={24} aria-hidden="true" /></span><p className="empty-state__title">No invitations match this view</p><p className="empty-state__text">Send a new invitation or adjust the completion and date filters.</p></div>
        }
        footer={<><span>Showing <strong>{filtered.length}</strong> invitation{filtered.length === 1 ? "" : "s"}</span><span className="cell-muted">Invitation emails are logged in the audit trail and email log</span></>}
      /></div>

      <InvitationProgressModal invitation={progress} onClose={() => setProgress(null)} />

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title="Invitation Details"
        subtitle={viewing?.email}
        size="md"
        footer={viewing ? (
          <>
            <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
            <Button variant="outline" icon={RefreshCw} onClick={() => act(viewing, actionFor(viewing) === "details" ? "resend" : actionFor(viewing))} disabled={Boolean(busyId)}>{actionFor(viewing) === "renew" ? "Renew & Resend" : "Resend Invitation"}</Button>
            <Button variant="outline" icon={BellRing} onClick={() => act(viewing, "remind")} disabled={Boolean(busyId)}>Remind</Button>
            <Button variant="danger-ghost" icon={Trash2} onClick={() => { setViewing(null); setRemoving(viewing); }} disabled={Boolean(busyId)}>Remove Invitation</Button>
          </>
        ) : undefined}
      >
        {viewing && (
          <div className="invitation-view">
            <div className="invitation-view__hero">
              <div className="avatar avatar--lg"><Mail size={24} aria-hidden="true" /></div>
              <div>
                <h3 className="invitation-view__email">{viewing.email}</h3>
                <p className="invitation-view__name">{viewing.fullName || "Name not provided by HR"}</p>
                <div className="invitation-view__badges">
                  {(() => { const meta = STATUS_VARIANT[viewing.status] ?? { label: viewing.status, variant: "grey" as const }; return <Badge variant={meta.variant} dot>{meta.label}</Badge>; })()}
                  <Badge variant={viewing.completion === 100 ? "green" : "blue"}>{viewing.completion}% complete</Badge>
                </div>
              </div>
            </div>

            <div className="invitation-progress-row">
              <div className="mini-progress"><div className="mini-progress__track"><div className="mini-progress__bar" style={{ width: `${viewing.completion}%` }} /></div><span>{viewing.completion}%</span></div>
              <Button variant="ghost" size="sm" icon={Eye} onClick={() => { setViewing(null); setProgress(viewing); }} type="button">View profile progress</Button>
            </div>

            <div className="detail-grid">
              <div className="detail-item"><div className="detail-item__label">First Sent</div><div className="detail-item__value">{formatDateTime(viewing.initialSentAt)}</div></div>
              <div className="detail-item"><div className="detail-item__label">Link Validity</div><div className="detail-item__value">Never expires</div></div>
              <div className="detail-item"><div className="detail-item__label">Last Reminder</div><div className="detail-item__value">{viewing.lastReminderSentAt ? formatDateTime(viewing.lastReminderSentAt) : "No reminders sent"}</div></div>
              <div className="detail-item"><div className="detail-item__label">Total Reminders</div><div className="detail-item__value">{viewing.reminderCount}</div></div>
              <div className="detail-item"><div className="detail-item__label">Token Renewed</div><div className="detail-item__value">{viewing.tokenRenewedAt ? `${formatDateTime(viewing.tokenRenewedAt)} · ${viewing.tokenRenewalCount} time${viewing.tokenRenewalCount === 1 ? "" : "s"}` : "Not renewed"}</div></div>
              <div className="detail-item"><div className="detail-item__label">Completed</div><div className="detail-item__value">{viewing.completedAt ? formatDateTime(viewing.completedAt) : "—"}</div></div>
            </div>

            {hasDetails && (
              <div className="detail-section">
                <div className="detail-section__title"><FileSearch size={16} aria-hidden="true" /> Employee Information {detail?.submission ? "(Submitted)" : "(Draft)"}</div>
                {detailLoading && <div className="loading-block"><div className="spinner" /> Loading details…</div>}
                <div className="detail-grid detail-grid--3">
                  {fieldEntries.map((field) => (
                    <div className="detail-item" key={field.key}>
                      <div className="detail-item__label">{field.label}</div>
                      <div className="detail-item__value">{field.value}</div>
                    </div>
                  ))}
                </div>
                {cvFileId && (
                  <div className="cv-file" style={{ marginTop: "0.75rem" }}>
                    <span className="cv-file__icon"><FileSearch size={22} aria-hidden="true" /></span>
                    <div className="cv-file__info">
                      <div className="cv-file__name">Employee CV</div>
                      <div className="cv-file__meta">Uploaded through self-service onboarding</div>
                    </div>
                    <div className="cv-file__actions">
                      <button type="button" className="btn btn--ghost btn--icon" onClick={() => void openCv(cvFileId)} disabled={previewing} title="Preview CV" aria-label="Preview CV"><Eye size={16} /></button>
                      <button type="button" className="btn btn--ghost btn--icon" onClick={() => void openCv(cvFileId)} disabled={previewing} title="Open CV" aria-label="Open CV"><Download size={16} /></button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="detail-section">
              <div className="detail-section__title"><BellRing size={16} aria-hidden="true" /> Reminder History</div>
              {viewing.reminders?.length ? (
                <ul className="reminder-history">
                  {viewing.reminders.map((reminder: any) => (
                    <li key={reminder.id} className="reminder-history__item"><div><div className="reminder-history__title">Reminder sent · {reminder.profileCompletion}% complete</div><div className="reminder-history__meta">{formatDateTime(reminder.sentAt)} · {reminder.purpose === "submit" ? "Submission reminder" : "Completion reminder"}{reminder.renewedToken ? " · Link renewed" : ""}</div></div></li>
                  ))}
                </ul>
              ) : <p className="cell-muted">No reminders have been sent for this invitation.</p>}
            </div>

            <div className="detail-section">
              <div className="detail-section__title"><Send size={16} aria-hidden="true" /> Activity</div>
              <ul className="history-timeline invitation-activity">
                <li className="history-timeline__item"><span className="history-timeline__marker" /><div><div className="history-timeline__role">Invitation sent</div><div className="history-timeline__dates">{formatDateTime(viewing.initialSentAt)}</div></div></li>
                {viewing.openedAt && <li className="history-timeline__item"><span className="history-timeline__marker" /><div><div className="history-timeline__role">Invitation opened</div><div className="history-timeline__dates">{formatDateTime(viewing.openedAt)}</div></div></li>}
                {viewing.draftUpdatedAt && <li className="history-timeline__item"><span className="history-timeline__marker" /><div><div className="history-timeline__role">Profile draft last saved</div><div className="history-timeline__dates">{formatDateTime(viewing.draftUpdatedAt)}</div></div></li>}
                {viewing.completedAt && <li className="history-timeline__item"><span className="history-timeline__marker" /><div><div className="history-timeline__role">Profile submitted</div><div className="history-timeline__dates">{formatDateTime(viewing.completedAt)}</div></div></li>}
              </ul>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(previewUrl)}
        onClose={() => { if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }}
        title="Employee CV"
        size="lg"
        footer={<Button icon={Download} onClick={() => previewUrl && window.open(previewUrl, "_blank", "noreferrer")} loading={previewing}>Open CV</Button>}
      >
        {previewUrl && <iframe title="Employee CV" src={previewUrl} style={{ width: "100%", height: 520, border: 0 }} />}
      </Modal>

      <Modal
        open={Boolean(removing)}
        onClose={() => (removeLoading ? undefined : setRemoving(null))}
        title="Remove invitation"
        size="sm"
        footer={(
          <>
            <Button variant="outline" onClick={() => setRemoving(null)} disabled={removeLoading}>Keep invitation</Button>
            <Button variant="danger" onClick={confirmRemove} loading={removeLoading}>Remove invitation</Button>
          </>
        )}
      >
        <p>Are you sure you want to permanently remove this invitation for <strong>{removing?.email}</strong>?</p>
        <p>The employee record will remain in the databank. Only the invitation will be deleted and the token will no longer work.</p>
      </Modal>
    </div>
  );
}
