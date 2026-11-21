import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Eye,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UsersRound,
  XCircle,
} from "lucide-react";
import { hrApi } from "../../lib/api";
import { useApiQuery, queryKeys } from "../../hooks/useApiQuery";
import PageHeader from "../../components/ref/PageHeader";
import Button from "../../components/ref/Button";
import Modal from "../../components/ref/Modal";
import CandidateStatusBadge from "../../components/ref/CandidateStatusBadge";
import EmptyState from "../../components/ref/EmptyState";
import DataTable, { type Column } from "../../components/DataTable";
import { initials, formatDate } from "./databank/shared";
import { Input, Select } from "../../components/ref/Input";

type Filter = "pending" | "approved" | "all";

export default function Approvals() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Filter>("pending");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [review, setReview] = useState<any>(null);
  const [reviewDetail, setReviewDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [positionId, setPositionId] = useState("");
  const [approvalOffered, setApprovalOffered] = useState("");
  const [approvalExpected, setApprovalExpected] = useState("");
  const [savingApproval, setSavingApproval] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const selected = await hrApi.applications({ page: 1, pageSize: 100, status: "SELECTED" }).then((r: any) => r?.data?.items ?? []);
      setApplications(selected);
      setError("");
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Could not load approval queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const { data: positions = [] } = useApiQuery<any[]>(
    queryKeys.openings({ dropdown: true }),
    () => hrApi.openings({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? []),
  );

  useEffect(() => {
    const app = reviewDetail ?? review;
    if (!app) return;
    setApprovalOffered(app.finalSelectionSalary != null ? String(app.finalSelectionSalary) : "");
    setApprovalExpected(app.finalSelectionExpectedSalary != null ? String(app.finalSelectionExpectedSalary) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewDetail, review]);

  const openReview = async (application: any) => {
    setReview(application);
    setReviewDetail(null);
    setDetailLoading(true);
    setRejecting(false);
    setRejectionReason("");
    try {
      const res = await hrApi.application(application.id);
      setReviewDetail(res?.data?.item ?? res?.data ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Could not load the full candidate record.");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeReview = () => {
    if (busy) return;
    setReview(null);
    setReviewDetail(null);
  };

  const parseAmount = (value: string) => {
    const cleaned = value.replace(/[₹,\s]/g, "").replace(/^rs\.?/i, "").replace(/^inr/i, "");
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) && num >= 0 ? num : undefined;
  };

  const saveApprovalDetails = async () => {
    if (!review) throw new Error("No application selected.");
    const nextOffered = parseAmount(approvalOffered.trim());
    const nextExpected = parseAmount(approvalExpected.trim());
    if (nextOffered === undefined) throw new Error("Enter a valid offered salary.");
    if (nextExpected === undefined) throw new Error("Enter a valid expected salary.");
    setSavingApproval(true);
    try {
      const response = await hrApi.saveApplicationApproval(review.id, {
        finalSelectionSalary: nextOffered,
        finalSelectionExpectedSalary: nextExpected,
      });
      const updated = response?.data?.item ?? response?.data?.data?.item ?? null;
      if (updated) {
        setApplications((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
        setReviewDetail((current: any) => (current ? { ...current, ...updated } : current));
      }
      setNotice("Approval details saved.");
      return updated;
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || err?.message || "Could not save approval details.";
      setError(message);
      throw new Error(message);
    } finally {
      setSavingApproval(false);
    }
  };

  const adminDecision = async (action: "confirm" | "reject") => {
    if (!review) return;
    const currentIndex = filtered.findIndex((item) => item.id === review.id);
    const nextCandidate = currentIndex >= 0 ? filtered[currentIndex + 1] : undefined;
    setBusy(true);
    setError("");
    try {
      if (action === "confirm") {
        const updatedApp = await saveApprovalDetails();
        await hrApi.adminDecision(review.id, { action: "confirm" });
        setNotice(`${updatedApp?.candidate?.fullName ?? "The candidate"} has been approved — returned to HR hiring evaluation to send the offer.`);
      } else {
        await hrApi.adminDecision(review.id, { action: "reject", remarks: rejectionReason.trim() || undefined });
        setNotice("Rejected — the application moved to the hold pipeline.");
      }
      setRejecting(false);
      setRejectionReason("");
      if (nextCandidate && nextCandidate.id !== review.id) {
        await load(true);
        await openReview(nextCandidate);
      } else {
        setReview(null);
        setReviewDetail(null);
        await load(true);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || "The admin decision could not be recorded.");
    } finally {
      setBusy(false);
    }
  };

  const pending = useMemo(() => applications.filter((app) => !app.adminApprovedAt), [applications]);
  const approved = useMemo(() => applications.filter((app) => app.adminApprovedAt), [applications]);
  const counts = { pending: pending.length, approved: approved.length, all: applications.length };

  const filtered = useMemo(() => {
    const source = statusFilter === "pending" ? pending : statusFilter === "approved" ? approved : applications;
    const term = search.trim().toLowerCase();
    const matched = source.filter((app) => {
      if (positionId && app.jobOpeningId !== positionId) return false;
      if (!term) return true;
      return `${app.candidate?.fullName ?? ""} ${app.candidate?.email ?? ""} ${app.jobOpening?.title ?? ""} ${app.applicationCode ?? ""}`.toLowerCase().includes(term);
    });
    return [...matched].sort((left, right) => {
      const byPosition = String(left.jobOpening?.title ?? "").localeCompare(String(right.jobOpening?.title ?? ""));
      return byPosition || String(left.candidate?.fullName ?? "").localeCompare(String(right.candidate?.fullName ?? ""));
    });
  }, [applications, pending, approved, search, statusFilter, positionId]);

  const app = reviewDetail ?? review;
  const candidate = app?.candidate;
  const job = app?.jobOpening;

  const columns: Column<any>[] = [
    {
      key: "candidate",
      header: "Candidate",
      render: (row) => (
        <div className="cell-user">
          <div className="avatar">{initials(row.candidate?.fullName || "")}</div>
          <div className="cell-user__text">
            <button type="button" className="ta-link cell-user__name" onClick={() => openReview(row)}>{row.candidate?.fullName}</button>
            <div className="cell-user__sub">{row.applicationCode}</div>
          </div>
        </div>
      ),
    },
    { key: "position", header: "Position", render: (row) => <div><div>{row.jobOpening?.title || "—"}</div><div className="cell-muted">{row.jobOpening?.department?.name || "—"}</div></div> },
    { key: "designation", header: "Designation", render: (row) => <span>{row.jobOpening?.title || "—"}</span> },
    { key: "salary", header: "Salary", render: (row) => <span className="cell-muted">{row.finalSelectionSalary != null ? `₹ ${Number(row.finalSelectionSalary).toLocaleString()}` : "—"}</span> },
    { key: "expectedSalary", header: "Expected salary", render: (row) => <span className="cell-muted">{row.finalSelectionExpectedSalary != null ? `₹ ${Number(row.finalSelectionExpectedSalary).toLocaleString()}` : "—"}</span> },
    { key: "status", header: "Status", render: (row) => (row.adminApprovedAt ? <span className="badge badge--green">Admin approved</span> : <CandidateStatusBadge status={row.status} />) },
    { key: "actions", header: "Actions", className: "text-right", render: (row) => <div className="cell-actions"><button type="button" className="btn btn--ghost btn--icon" title="Open decision" aria-label="Open decision" onClick={() => openReview(row)}><Eye size={16} /></button></div> },
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Ecometrix · Talent Acquisition"
        title="Admin Approval"
        subtitle="Hiring recommendations submitted by HR. Confirm the offer or reject it to the hold pipeline. Confirmed candidates return to HR hiring evaluation for offer letter creation."
        actions={<Button variant="outline" icon={RefreshCw} onClick={() => void load(true)}>Refresh data</Button>}
      />

      {notice && <div className="notice notice--success" role="status"><div className="notice__body">{notice}</div></div>}
      {error && <div className="notice notice--error" role="alert"><div className="notice__body">{error}</div></div>}

      <div className="notice notice--info">
        <span className="notice__icon"><ShieldCheck size={18} aria-hidden="true" /></span>
        <div className="notice__body"><div className="notice__title">Authorisation note</div>Only the salary is recorded here — the designation comes from the applied position and cannot be changed by admin. Confirming returns the candidate to HR hiring evaluation; rejecting moves the application to the hold pipeline.</div></div>

      <div className="ta-interview-summary">
        <div className="ta-interview-summary__item"><span className="ta-interview-summary__label">Pending admin decision</span><span className="ta-interview-summary__value">{counts.pending}</span></div>
        <div className="ta-interview-summary__item"><span className="ta-interview-summary__label">Approved</span><span className="ta-interview-summary__value">{counts.approved}</span></div>
        <div className="ta-interview-summary__item"><span className="ta-interview-summary__label">Total selected</span><span className="ta-interview-summary__value">{counts.all}</span></div>
      </div>

      <div className="page-toolbar"><div className="search-box"><span className="search-box__icon"><UsersRound size={16} aria-hidden="true" /></span><input type="search" className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by candidate, application ID or position" aria-label="Search the approval queue" /></div><Select aria-label="Filter by applied position" value={positionId} onChange={(event) => setPositionId(event.target.value)} placeholder="All positions" options={positions.map((o: any) => ({ value: o.id, label: o.title }))} /><div className="filters"><button type="button" className={`ta-filter-chip ${statusFilter === "pending" ? "active" : ""}`} onClick={() => setStatusFilter("pending")}>Pending <span className="ta-filter-chip__count">{counts.pending}</span></button><button type="button" className={`ta-filter-chip ${statusFilter === "approved" ? "active" : ""}`} onClick={() => setStatusFilter("approved")}>Approved <span className="ta-filter-chip__count">{counts.approved}</span></button><button type="button" className={`ta-filter-chip ${statusFilter === "all" ? "active" : ""}`} onClick={() => setStatusFilter("all")}>All <span className="ta-filter-chip__count">{counts.all}</span></button></div></div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        loading={loading}
        empty={<EmptyState icon={UserCheck} title="No approvals match this view" description="Selected candidates appear here after the hiring evaluation is submitted by HR." action={<Link className="btn btn--outline btn--sm" to="/hr/final-selection">Review hiring evaluation</Link>} />}
        footer={<><span>Showing <strong>{filtered.length}</strong> approval record{filtered.length === 1 ? "" : "s"}</span><span className="cell-muted">Confirm to send back to HR · reject moves to hold</span></>}
      />

      <Modal
        open={Boolean(review)}
        onClose={closeReview}
        title={review ? `Admin decision · ${review.candidate?.fullName}` : "Admin decision"}
        subtitle={review ? `${review.jobOpening?.title} · ${review.applicationCode}` : undefined}
        size="lg"
        footer={review ? (
          <>
            <Button variant="outline" onClick={closeReview} disabled={busy}>Close</Button>
            {!app?.adminApprovedAt && !rejecting && (
              <>
                <Button variant="danger-ghost" icon={XCircle} onClick={() => setRejecting(true)} disabled={busy}>Reject</Button>
                <Button icon={ShieldCheck} onClick={() => void adminDecision("confirm")} loading={busy}>Offer Confirm</Button>
              </>
            )}
            {app?.adminApprovedAt && <span className="badge badge--green">Already approved — HR sends the offer from hiring evaluation</span>}
            {rejecting && (
              <>
                <Button variant="outline" onClick={() => setRejecting(false)} disabled={busy}>Back</Button>
                <Button variant="danger" onClick={() => void adminDecision("reject")} loading={busy}>Reject — move to hold</Button>
              </>
            )}
          </>
        ) : undefined}
      >
        {app && (
          <div className="ta-profile-grid">
            <section className="card ta-profile-main">
              <div className="card__header">
                <div>
                  <div className="card__title">Candidate</div>
                  <div className="card__subtitle">Submitted by HR for admin approval</div>
                </div>
                <CandidateStatusBadge status={app.status} />
              </div>
              <div className="card__body">
                <div className="detail-grid">
                  <div className="detail-item"><div className="detail-item__label">Candidate ID</div><div className="detail-item__value">{candidate?.candidateCode || "—"}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Application ID</div><div className="detail-item__value">{app.applicationCode}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Position</div><div className="detail-item__value">{job?.title || "—"}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Submitted on</div><div className="detail-item__value">{app.updatedAt ? formatDate(app.updatedAt) : "—"}</div></div>
                  <div className="detail-item"><div className="detail-item__label"><Mail size={12} aria-hidden="true" /> Email</div><div className="detail-item__value">{candidate?.email}</div></div>
                  <div className="detail-item"><div className="detail-item__label"><Phone size={12} aria-hidden="true" /> Phone</div><div className="detail-item__value">{candidate?.mobile || "—"}</div></div>
                  <div className="detail-item"><div className="detail-item__label"><MapPin size={12} aria-hidden="true" /> Location</div><div className="detail-item__value">{candidate?.currentLocation || "—"}</div></div>
                </div>
                <div className="detail-section">
                  <h4 className="detail-section__title">HR decision record</h4>
                  <div className="detail-grid">
                    <div className="detail-item"><div className="detail-item__label">HR recommendation</div><div className="detail-item__value"><CandidateStatusBadge status={app.status} /></div></div>
                    <div className="detail-item"><div className="detail-item__label">Offered salary (CTC)</div><div className="detail-item__value">{app.finalSelectionSalary != null ? `₹ ${Number(app.finalSelectionSalary).toLocaleString()}` : "—"}</div></div>
                    <div className="detail-item"><div className="detail-item__label">Candidate expected salary</div><div className="detail-item__value">{app.finalSelectionExpectedSalary != null ? `₹ ${Number(app.finalSelectionExpectedSalary).toLocaleString()}` : "—"}</div></div>
                    <div className="detail-item"><div className="detail-item__label">Screening score</div><div className="detail-item__value">{app.aiMatchScore != null ? `${Math.round(Number(app.aiMatchScore))}%` : "Not scored"}</div></div>
                  </div>
                  <div className="detail-item" style={{ marginTop: "0.75rem" }}><div className="detail-item__label">Decision remarks</div><div className="detail-item__value">{app.hrRemarks || "No remarks recorded."}</div></div>
                  {app.finalSelectionNote && <div className="detail-item" style={{ marginTop: "0.75rem" }}><div className="detail-item__label">Final note</div><div className="detail-item__value">{app.finalSelectionNote}</div></div>}
                </div>
                {rejecting && <div className="field" style={{ marginTop: "1rem" }}><label className="field__label" htmlFor="approval-reject-reason">Reason for rejection <span className="field__optional">(optional)</span></label><textarea id="approval-reject-reason" className="textarea" rows={3} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Tell HR why this candidate cannot be approved…" /></div>}
                {detailLoading && <div className="notice notice--info" style={{ marginTop: "1rem" }}><div className="notice__body">Refreshing the full candidate record…</div></div>}
              </div>
            </section>

            <section className="card">
              <div className="card__header">
                <div><div className="card__title">Admin decision</div><div className="card__subtitle">Salary only — designation comes from the applied position and cannot be changed here.</div></div>
                <Button size="sm" variant="outline" onClick={() => void saveApprovalDetails().catch(() => undefined)} loading={savingApproval}>Save details</Button>
              </div>
              <div className="card__body">
                <div className="form-grid">
                  <div className="detail-item field--full">
                    <div className="detail-item__label">Designation (from applied position)</div>
                    <div className="detail-item__value">{job?.title || app?.finalSelectionDesignation || "—"}</div>
                  </div>
                  <Input label="Offered salary (annual CTC)" type="number" min={0} value={approvalOffered} onChange={(event) => setApprovalOffered(event.target.value)} placeholder="e.g. 1200000" inputMode="numeric" />
                  <Input label="Candidate expected salary" type="number" min={0} value={approvalExpected} onChange={(event) => setApprovalExpected(event.target.value)} placeholder="e.g. 1400000" inputMode="numeric" />
                </div>
                <div className="detail-item" style={{ marginTop: "0.75rem" }}>
                  <div className="detail-item__label">Department</div>
                  <div className="detail-item__value">{job?.department?.name || "—"}</div>
                </div>
                {app?.adminApprovedAt && <div className="notice notice--success" style={{ marginTop: "1rem" }}><div className="notice__body"><div className="notice__title">Admin approved</div><div>On {formatDate(app.adminApprovedAt)}. HR can now create and send the offer letter from the Hiring Evaluation page.</div></div></div>}
              </div>
            </section>
          </div>
        )}
      </Modal>
    </div>
  );
}
