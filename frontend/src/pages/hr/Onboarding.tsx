import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { BellRing, Briefcase, CheckCircle2, Download, Eye, FileCheck2, FileText, Mail, RefreshCw, Search, Upload, XCircle } from "lucide-react";
import { hrApi } from "../../lib/api";
import Badge from "../../components/ref/Badge";
import PageHeader from "../../components/ref/PageHeader";
import Button from "../../components/ref/Button";
import Modal from "../../components/ref/Modal";
import CandidateStatusBadge from "../../components/ref/CandidateStatusBadge";
import EmptyState from "../../components/ref/EmptyState";
import DataTable, { type Column } from "../../components/DataTable";
import { formatDate, formatDateTime, initials } from "./databank/shared";
import { useApiQuery, useInvalidate } from "../../hooks/useApiQuery";

const DOC_STATUS_META: Record<string, { label: string; variant: "green" | "orange" | "blue" | "red" | "grey" }> = {
  NOT_UPLOADED: { label: "Not uploaded", variant: "grey" },
  UPLOADED: { label: "Uploaded", variant: "orange" },
  UNDER_REVIEW: { label: "Under review", variant: "blue" },
  ACCEPTED: { label: "Accepted", variant: "green" },
  REJECTED: { label: "Rejected", variant: "red" },
  REUPLOAD_REQUIRED: { label: "Re-upload requested", variant: "orange" },
};

const offerStatusMeta = (status?: string) => {
  switch (status) {
    case "ACCEPTED": return { label: "Accepted", variant: "green" as const };
    case "DECLINED": return { label: "Rejected", variant: "red" as const };
    case "SENT":
    case "VIEWED": return { label: "Pending response", variant: "orange" as const };
    case "DRAFT": return { label: "Offer draft", variant: "grey" as const };
    default: return { label: "Waiting for offer", variant: "grey" as const };
  }
};

const docStatusMeta = (status?: string) => DOC_STATUS_META[status ?? "NOT_UPLOADED"] ?? DOC_STATUS_META.NOT_UPLOADED;
const pageSize = 25;
const offerFilterOptions = [
  { value: "all", label: "All candidates" },
  { value: "pending", label: "Pending response" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
];

const matchesSearch = (term: string, values: Array<unknown>) => {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  return values.filter(Boolean).some((value) => String(value).toLowerCase().includes(needle));
};

export default function Onboarding() {
  const navigate = useNavigate();
  const [view, setView] = useState<"candidates" | "documents">("candidates");
  const [search, setSearch] = useState("");
  const [offerFilter, setOfferFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [selectedForOffer, setSelectedForOffer] = useState<any>(null);
  const [docReminding, setDocReminding] = useState<string | null>(null);
  const invalidate = useInvalidate();
  const [onboardingId, setOnboardingId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { data: docs = [], isLoading, refetch } = useApiQuery<any[]>(
    ["documents", "all"],
    () => hrApi.documents({ page: 1, pageSize: 500 }).then((r: any) => r?.data?.items ?? []),
  );
  const { data: offers = [] } = useApiQuery<any[]>(
    ["offers", "onboarding", "all"],
    () => hrApi.offers({ page: 1, pageSize: 500 }).then((r: any) => r?.data?.items ?? r?.data ?? []),
  );
  const { data: readyApps = [] } = useApiQuery<any[]>(
    ["onboarding", "ready"],
    () => Promise.all(
      ["OFFER_ACCEPTED", "DOCUMENTS_PENDING", "DOCUMENTS_UNDER_REVIEW"].map((status) =>
        hrApi.applications({ page: 1, pageSize: 20, status }).then((r: any) => r?.data?.items ?? []),
      ),
    ).then((lists) => lists.flat()),
  );

  useEffect(() => { setPage(1); }, [search, offerFilter]);

  const visibleReady = readyApps.filter((a) => !dismissed.has(a.id));

  const candidates = useMemo(() => {
    const map = new Map<string, any>();
    const docMap = new Map<string, any[]>();
    for (const doc of docs) {
      const key = doc.applicationId ?? doc.application?.id;
      if (!key) continue;
      if (!docMap.has(key)) docMap.set(key, []);
      docMap.get(key)!.push(doc);
    }
    for (const offer of offers) {
      const application = offer.application ?? {};
      const key = application.id ?? offer.applicationId;
      if (!key) continue;
      map.set(key, { key, offer, application, candidate: application.candidate, job: application.jobOpening, docs: docMap.get(key) ?? [] });
    }
    for (const doc of docs) {
      const application = doc.application ?? {};
      const key = doc.applicationId ?? application.id;
      if (!key || map.has(key)) continue;
      map.set(key, { key, offer: null, application, candidate: application.candidate, job: application.jobOpening, docs: docMap.get(key) ?? [] });
    }
    return Array.from(map.values()).sort((left, right) => {
      const leftTime = new Date(left.offer?.respondedAt ?? left.offer?.sentAt ?? left.application?.createdAt ?? 0).getTime();
      const rightTime = new Date(right.offer?.respondedAt ?? right.offer?.sentAt ?? right.application?.createdAt ?? 0).getTime();
      return rightTime - leftTime;
    });
  }, [docs, offers]);

  const candidateCounts = useMemo(() => ({
    all: candidates.length,
    pending: candidates.filter((row) => ["SENT", "VIEWED"].includes(row.offer?.status)).length,
    accepted: candidates.filter((row) => row.offer?.status === "ACCEPTED").length,
    rejected: candidates.filter((row) => row.offer?.status === "DECLINED").length,
    docsAccepted: candidates.filter((row) => row.docs.length > 0 && row.docs.every((doc: any) => doc.status === "ACCEPTED")).length,
  }), [candidates]);

  const filteredCandidates = useMemo(() => candidates.filter((row) => {
    const offerStatus = row.offer?.status;
    const matchesFilter = offerFilter === "all" || (offerFilter === "pending" ? ["SENT", "VIEWED", "DRAFT"].includes(offerStatus) : offerFilter === "accepted" ? offerStatus === "ACCEPTED" : offerFilter === "rejected" ? offerStatus === "DECLINED" : true);
    if (!matchesFilter) return false;
    return matchesSearch(search, [row.candidate?.fullName, row.candidate?.email, row.candidate?.mobile, row.application?.applicationCode, row.job?.title, row.job?.department?.name, row.offer?.designation, row.offer?.responseRemarks]);
  }), [candidates, search, offerFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCandidates.length / pageSize));
  const pagedCandidates = filteredCandidates.slice((page - 1) * pageSize, page * pageSize);

  const filteredDocs = docs.filter((d) => matchesSearch(search, [d.application?.candidate?.fullName, d.application?.applicationCode, d.category?.name, d.status]));
  const pendingDocs = filteredDocs.filter((d) => ["NOT_UPLOADED", "REUPLOAD_REQUIRED"].includes(d.status));

  const submitted = useMemo(() => docs.filter((d) => ["UPLOADED", "UNDER_REVIEW", "REJECTED", "ACCEPTED"].includes(d.status)), [docs]);
  const pending = useMemo(() => docs.filter((d) => ["NOT_UPLOADED", "REUPLOAD_REQUIRED"].includes(d.status)), [docs]);

  const counts = {
    ready: visibleReady.length,
    submitted: submitted.length,
    verification: docs.filter((d) => d.status === "UPLOADED" || d.status === "UNDER_REVIEW").length,
    reupload: docs.filter((d) => d.status === "REUPLOAD_REQUIRED").length,
  };

  const addToExisting = async (app: any) => {
    const name = app.candidate?.fullName ?? "This candidate";
    if (!window.confirm(`Add ${name} to Existing Employees?\n\nThis creates a new employee record (reusing the offer details and CV) and marks the application as HIRED.`)) return;
    setOnboardingId(app.id);
    setError("");
    try {
      await hrApi.onboardEmployeeFromApplication(app.id);
      window.setTimeout(() => navigate("/hr/employees?tab=current"), 250);
      setNotice(`${name} added to Existing Employees.`);
      setDismissed(new Set([...dismissed, app.id]));
      invalidate(["documents", "dashboard", "employees", "employee"]);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not add the employee.");
    } finally {
      setOnboardingId(null);
    }
  };

  const keepInPipeline = (app: any) => {
    setDismissed(new Set([...dismissed, app.id]));
    setNotice(`${app.candidate?.fullName ?? "Candidate"} stays in the recruitment pipeline.`);
  };

  const verify = async (id: string, status: "ACCEPTED" | "REJECTED" | "REUPLOAD_REQUIRED") => {
    const remarks = status === "ACCEPTED" ? window.prompt("Verification remarks (optional):") || undefined : window.prompt(status === "REJECTED" ? "Reason for rejection:" : "What needs to be re-uploaded?") || undefined;
    try {
      await hrApi.verifyDocument(id, { status, remarks: remarks ?? null });
      setNotice(`Document marked ${DOC_STATUS_META[status]?.label ?? status}.`);
      invalidate(["documents", "dashboard"]);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Verification failed.");
    }
  };

  const remindDocument = async (id: string) => {
    setDocReminding(id);
    try {
      await hrApi.remindDocument(id);
      setNotice("Reminder email queued for the candidate.");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not send reminder.");
    } finally { setDocReminding(null); }
  };

  const remindOffer = async (offerId: string, candidateName?: string) => {
    try {
      await hrApi.remindOffer(offerId);
      setNotice(`Reminder sent to ${candidateName ?? "the candidate"}.`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not send the offer reminder.");
    }
  };

  const viewDocument = async (fileId?: string) => {
    if (!fileId) return;
    try {
      const r = await hrApi.fileAccessToken(fileId);
      const token = r?.data?.token;
      if (token) {
        const blobRes = await hrApi.file(fileId, token);
        const url = URL.createObjectURL(blobRes.data as Blob);
        window.open(url, "_blank", "noreferrer");
      } else {
        window.open(r?.data?.url, "_blank", "noreferrer");
      }
    } catch {
      setError("Cannot open this document.");
    }
  };

  const exportCsv = () => {
    const header = ["Candidate", "Email", "Application", "Position", "Offer status", "Feedback", "Documents accepted", "Documents uploaded", "Re-upload required"];
    const lines = filteredCandidates.map((row) => {
      const docs = row.docs ?? [];
      const accepted = docs.filter((doc: any) => doc.status === "ACCEPTED").length;
      const uploaded = docs.filter((doc: any) => ["UPLOADED", "UNDER_REVIEW", "ACCEPTED"].includes(doc.status)).length;
      const reupload = docs.filter((doc: any) => doc.status === "REUPLOAD_REQUIRED").length;
      return [row.candidate?.fullName ?? "", row.candidate?.email ?? "", row.application?.applicationCode ?? "", row.job?.title ?? "", row.offer?.status ?? "No offer", row.offer?.responseRemarks ?? "", accepted, uploaded, reupload];
    });
    const csvEscape = (value: unknown) => /[",\n\r]/.test(String(value ?? "")) ? `"${String(value ?? "").replace(/"/g, '""')}"` : String(value ?? "");
    const csv = [header, ...lines].map((columns) => columns.map(csvEscape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `onboarding-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const selectedCandidate = selectedCandidateId ? pagedCandidates.find((row) => row.key === selectedCandidateId) ?? candidates.find((row) => row.key === selectedCandidateId) : null;

  const candidateColumns: Column<any>[] = [
    {
      key: "candidate", header: "Candidate", render: (row) => (
        <div className="cell-user"><div className="avatar">{initials(row.candidate?.fullName || "")}</div><div className="cell-user__text"><button type="button" className="ta-link cell-user__name" onClick={() => setSelectedCandidateId(row.key)}>{row.candidate?.fullName || "Candidate"}</button><div className="cell-user__sub">{row.candidate?.email}</div></div></div>
      ),
    },
    { key: "position", header: "Position", render: (row) => <div className="cell-stack"><strong>{row.job?.title ?? "—"}</strong><span className="cell-muted">{row.application?.applicationCode ?? "—"}</span></div> },
    { key: "offer", header: "Offer status", render: (row) => { const meta = offerStatusMeta(row.offer?.status); return <Badge variant={meta.variant} dot>{meta.label}</Badge>; } },
    { key: "documents", header: "Documents", render: (row) => { const accepted = row.docs.filter((doc: any) => doc.status === "ACCEPTED").length; const uploaded = row.docs.filter((doc: any) => ["UPLOADED", "UNDER_REVIEW", "ACCEPTED"].includes(doc.status)).length; const reupload = row.docs.filter((doc: any) => doc.status === "REUPLOAD_REQUIRED").length; return <div className="doc-progress"><span>{uploaded} uploaded</span><span className="cell-muted">{accepted} accepted</span>{reupload > 0 && <Badge variant="orange">{reupload} re-upload</Badge>}</div>; } },
    { key: "feedback", header: "Candidate feedback", render: (row) => row.offer?.responseRemarks ? <span className="cell-ellipsis" title={row.offer.responseRemarks}>{row.offer.responseRemarks}</span> : <span className="cell-muted">—</span> },
    { key: "action", header: "Actions", className: "text-right", render: (row) => <div className="cell-actions"><button type="button" className="btn btn--ghost btn--icon" aria-label="View details" title="View details" onClick={() => setSelectedCandidateId(row.key)}><Eye size={16} /></button>{row.offer?.id && ["SENT", "VIEWED"].includes(row.offer.status) && <button type="button" className="btn btn--ghost btn--icon" aria-label="Send offer reminder" title="Send offer reminder" onClick={() => remindOffer(row.offer.id, row.candidate?.fullName)}><BellRing size={16} /></button>}</div> },
  ];

  const documentColumns: Column<any>[] = [
    { key: "candidate", header: "Candidate", render: (d) => <div className="cell-user"><div className="avatar">{initials(d.application?.candidate?.fullName || "")}</div><div className="cell-user__text"><div className="cell-user__name">{d.application?.candidate?.fullName}</div><div className="cell-user__sub">{d.application?.applicationCode}</div></div></div> },
    { key: "cat", header: "Document", render: (d) => <div><div>{d.category?.name}</div>{d.category?.isRequired && <div className="cell-muted">Required</div>}</div> },
    { key: "status", header: "Verification", render: (d) => { const meta = docStatusMeta(d.status); return <Badge variant={meta.variant} dot>{meta.label}</Badge>; } },
    { key: "updated", header: "Updated", render: (d) => <span className="cell-muted">{d.uploadedAt ? formatDate(d.uploadedAt) : "—"}</span> },
    { key: "actions", header: "Actions", className: "text-right", render: (d) => (
      <div className="cell-actions">
        {d.fileId && <button type="button" className="btn btn--ghost btn--icon" title="View document" aria-label="View document" onClick={() => void viewDocument(d.fileId)}><FileText size={16} /></button>}
        {d.status !== "ACCEPTED" && <button type="button" className="btn btn--outline btn--icon" title="Accept" aria-label="Accept document" onClick={() => verify(d.id, "ACCEPTED")}><CheckCircle2 size={16} /></button>}
        <button type="button" className="btn btn--ghost btn--icon" title="Request re-upload" aria-label="Request re-upload" onClick={() => verify(d.id, "REUPLOAD_REQUIRED")}><RefreshCw size={16} /></button>
        <button type="button" className="btn btn--danger-ghost btn--icon" title="Reject" aria-label="Reject document" onClick={() => verify(d.id, "REJECTED")}><XCircle size={16} /></button>
        <button type="button" className="btn btn--ghost btn--icon" title="Send reminder" aria-label="Send reminder" onClick={() => void remindDocument(d.id)} disabled={docReminding === d.id}><BellRing size={16} /></button>
      </div>
    ) },
  ];



  return (
    <div className="page">
      <PageHeader
        eyebrow="Ecometrix · Talent Acquisition"
        title="Joining & Onboarding"
        subtitle="Every offer sent/accepted, candidate feedback and required documents in one scalable, filterable view."
        actions={<><Button variant="outline" icon={RefreshCw} onClick={() => void refetch()}>Refresh data</Button><Button variant="outline" icon={Download} onClick={exportCsv}>Export CSV</Button></>}
      />

      {notice && <div className="notice notice--success" role="status"><div className="notice__body">{notice}</div></div>}
      {error && <div className="notice notice--error" role="alert"><div className="notice__body">{error}</div></div>}

      <div className="ta-interview-summary">
        <div className="ta-interview-summary__item"><span className="ta-interview-summary__label">Ready to join</span><span className="ta-interview-summary__value">{counts.ready}</span></div>
        <div className="ta-interview-summary__item"><span className="ta-interview-summary__label">Accepted offers</span><span className="ta-interview-summary__value">{candidateCounts.accepted}</span></div>
        <div className="ta-interview-summary__item"><span className="ta-interview-summary__label">Pending response</span><span className="ta-interview-summary__value">{candidateCounts.pending}</span></div>
        <div className="ta-interview-summary__item"><span className="ta-interview-summary__label">Rejected / declined</span><span className="ta-interview-summary__value">{candidateCounts.rejected}</span></div>
      </div>

      {visibleReady.length > 0 && (
        <section className="card">
          <div className="card__header"><div><div className="card__title">Ready for onboarding</div><div className="card__subtitle">These accepted candidates can now be added to your employee register.</div></div><span className="badge badge--green">{visibleReady.length} ready</span></div>
          <div className="card__body">
            <ul className="ta-list">
              {visibleReady.slice(0, 5).map((a) => (
                <li className="ta-list__item" key={a.id}>
                  <div className="ta-list__body"><div className="ta-list__title">{a.candidate?.fullName}</div><div className="ta-list__meta">{a.jobOpening?.title} · {a.jobOpening?.department?.name || "—"} · <span className="font-mono">{a.applicationCode}</span></div></div>
                  <div className="ta-inline-actions"><Button size="sm" variant="primary" disabled={onboardingId === a.id} onClick={() => void addToExisting(a)} loading={onboardingId === a.id}>Yes — Add to Existing</Button><Button size="sm" variant="outline" onClick={() => keepInPipeline(a)}>No — Keep in Pipeline</Button></div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <div className="page-toolbar">
        <div className="search-box"><span className="search-box__icon"><Search size={16} aria-hidden="true" /></span><input type="search" className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search candidate, application, position or feedback" aria-label="Search onboarding candidates" /></div>
        <div className="filters">
          <button type="button" className={`ta-filter-chip ${view === "candidates" ? "active" : ""}`} onClick={() => setView("candidates")}>Candidates <span className="ta-filter-chip__count">{filteredCandidates.length}</span></button>
          <button type="button" className={`ta-filter-chip ${view === "documents" ? "active" : ""}`} onClick={() => setView("documents")}>Documents <span className="ta-filter-chip__count">{pendingDocs.length}</span></button>
        </div>
      </div>

      {view === "candidates" && (
        <>
          <div className="onboarding-filter-row" aria-label="Candidate onboarding filters">
            {offerFilterOptions.map((filter) => <button type="button" className={`ta-filter-chip ${offerFilter === filter.value ? "active" : ""}`} key={filter.value} onClick={() => setOfferFilter(filter.value)}>{filter.label} <span className="ta-filter-chip__count">{filter.value === "all" ? candidateCounts.all : filter.value === "pending" ? candidateCounts.pending : filter.value === "accepted" ? candidateCounts.accepted : candidateCounts.rejected}</span></button>)}
          </div>
          <DataTable
            columns={candidateColumns}
            rows={pagedCandidates}
            rowKey={(row) => row.key}
            loading={isLoading}
            empty={<EmptyState icon={Briefcase} title="No candidates match this view" description="Once offers are sent, response and documents will appear here." />}
            footer={<><span>Showing <strong>{pagedCandidates.length}</strong> of <strong>{filteredCandidates.length}</strong> candidates{filteredCandidates.length ? ` · Page ${page} of ${totalPages}` : ""}</span><span className="cell-muted">Per-candidate acceptance and document progress</span><div className="ta-pagination"><button type="button" className="btn btn--outline btn--sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><span className="ta-pagination__status">Page {page} of {totalPages}</span><button type="button" className="btn btn--outline btn--sm" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button></div></>}
          />
        </>
      )}

      {view === "documents" && (
        <DataTable
          columns={documentColumns}
          rows={filteredDocs}
          rowKey={(r) => r.id}
          loading={isLoading}
          empty={<EmptyState icon={Mail} title="No documents match this view" description="Offer acceptance initialises the required document list." />}
          footer={<><span>Showing <strong>{filteredDocs.length}</strong> document{filteredDocs.length === 1 ? "" : "s"}</span><span className="cell-muted">Upload/re-upload reminders are logged in the audit trail</span></>}
        />
      )}

      <Modal
        open={Boolean(selectedCandidate)}
        onClose={() => setSelectedCandidateId(null)}
        title={selectedCandidate ? selectedCandidate.candidate?.fullName ?? "Candidate" : "Candidate"}
        subtitle={selectedCandidate?.job?.title ?? undefined}
        size="xl"
        footer={selectedCandidate?.offer?.id && ["SENT", "VIEWED", "DRAFT"].includes(selectedCandidate.offer.status) ? <Button icon={BellRing} onClick={() => remindOffer(selectedCandidate.offer.id, selectedCandidate.candidate?.fullName)}>Send offer reminder</Button> : undefined}
      >
        {selectedCandidate && (() => {
          const docsInRow = selectedCandidate.docs ?? [];
          const accepted = docsInRow.filter((doc: any) => doc.status === "ACCEPTED");
          const pendingCount = docsInRow.length - accepted.length;
          const offerMeta = offerStatusMeta(selectedCandidate.offer?.status);
          return (
            <div className="onboarding-candidate-layout">
              <section className="ta-panel">
                <div className="ta-panel__header">Candidate and application</div>
                <div className="detail-grid detail-grid--3">
                  <div className="detail-item"><div className="detail-item__label">Candidate ID</div><div className="detail-item__value">{selectedCandidate.candidate?.candidateCode ?? "—"}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Application</div><div className="detail-item__value">{selectedCandidate.application?.applicationCode ?? "—"}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Email</div><div className="detail-item__value">{selectedCandidate.candidate?.email ?? "—"}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Phone</div><div className="detail-item__value">{selectedCandidate.candidate?.mobile ?? "—"}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Position</div><div className="detail-item__value">{selectedCandidate.job?.title ?? "—"}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Department</div><div className="detail-item__value">{selectedCandidate.job?.department?.name ?? "—"}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Application status</div><div className="detail-item__value"><CandidateStatusBadge status={selectedCandidate.application?.status} /></div></div>
                  <div className="detail-item"><div className="detail-item__label">Offer status</div><div className="detail-item__value"><Badge variant={offerMeta.variant} dot>{offerMeta.label}</Badge></div></div>
                </div>
              </section>
              <section className="ta-panel">
                <div className="ta-panel__header">Offer response from candidate</div>
                <div className="detail-grid detail-grid--3">
                  <div className="detail-item"><div className="detail-item__label">CTC</div><div className="detail-item__value">{selectedCandidate.offer?.ctc != null ? `₹ ${Number(selectedCandidate.offer.ctc).toLocaleString("en-IN")}` : "—"}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Joining</div><div className="detail-item__value">{selectedCandidate.offer?.joiningDate ? formatDate(selectedCandidate.offer.joiningDate) : "—"}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Responded</div><div className="detail-item__value">{selectedCandidate.offer?.respondedAt ? formatDateTime(selectedCandidate.offer.respondedAt) : "Not responded"}</div></div>
                  <div className="detail-item" style={{ gridColumn: "1 / -1" }}><div className="detail-item__label">Candidate feedback / remarks</div><div className="detail-item__value">{selectedCandidate.offer?.responseRemarks ?? "No feedback uploaded by the candidate yet."}</div></div>
                </div>
              </section>
              <section className="ta-panel">
                <div className="ta-panel__header"><FileCheck2 size={15} aria-hidden="true" /> Documents <span className="ta-panel__meta">{accepted.length}/{docsInRow.length} accepted · {pendingCount} pending</span></div>
                {docsInRow.length === 0 ? <p className="detail-item__value detail-item__value--muted">No document list created yet. Documents are initialised when the offer is accepted.</p> : (
                  <ul className="ta-detail-list">{docsInRow.map((doc: any) => { const meta = docStatusMeta(doc.status); return (
                    <li className="ta-detail-list__item" key={doc.id}>
                      <div className="ta-detail-list__title">{doc.category?.name ?? "Document"}</div>
                      <div className="ta-detail-list__meta"><Badge variant={meta.variant} dot>{meta.label}</Badge>{doc.uploadedAt ? ` · ${formatDate(doc.uploadedAt)}` : ""}</div>
                      {doc.remarks && <p className="ta-detail-list__text">{doc.remarks}</p>}
                      <div className="doc-row-actions"><button type="button" className="ta-link" onClick={() => void viewDocument(doc.fileId)}>View file</button>{doc.status !== "ACCEPTED" && <button type="button" className="ta-link" onClick={() => void verify(doc.id, "ACCEPTED")}>Accept</button>}<button type="button" className="ta-link" onClick={() => void verify(doc.id, "REUPLOAD_REQUIRED")}>Re-upload</button>{doc.status !== "UPLOADED" && <button type="button" className="ta-link" onClick={() => void remindDocument(doc.id)}>Remind</button>}</div>
                    </li>
                  );})}</ul>
                )}
              </section>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
