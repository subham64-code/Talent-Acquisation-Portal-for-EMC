import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Briefcase,
  Download,
  Eye,
  FileSearch,
  RefreshCw,
  SlidersHorizontal,
  X,
  Search,
} from "lucide-react";
import { hrApi } from "../../lib/api";
import { useDebounced } from "../../hooks/useDebounced";
import { useApiQuery, queryKeys } from "../../hooks/useApiQuery";
import DataTable, { type Column } from "../../components/DataTable";
import PageHeader from "../../components/ref/PageHeader";
import Button from "../../components/ref/Button";
import Badge from "../../components/ref/Badge";
import Modal from "../../components/ref/Modal";
import CandidateStatusBadge from "../../components/ref/CandidateStatusBadge";
import EmptyState from "../../components/ref/EmptyState";
import { Select } from "../../components/ref/Input";
import { formatDate, formatDateTime, initials } from "./databank/shared";
import { APPLICATION_STATUS_LABELS, APPLICATION_TRANSITIONS } from "../../lib/applicationTransitions";

const NEW_APPLICATION_STATUS = "APPLIED";

const LABELS: Array<{ value: string; label: string }> = [
  { value: "APPLIED", label: "Applied" }, { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "AI_RECOMMENDED", label: "AI Recommended" }, { value: "SHORTLISTED", label: "Shortlisted" },
  { value: "INTERVIEW_SCHEDULED", label: "Interview Scheduled" }, { value: "INTERVIEW_COMPLETED", label: "Interview Completed" },
  { value: "SELECTED", label: "Selected" }, { value: "REJECTED", label: "Rejected" },
  { value: "ON_HOLD", label: "On Hold" }, { value: "OFFER_SENT", label: "Offer Sent" },
  { value: "OFFER_ACCEPTED", label: "Offer Accepted" }, { value: "DOCUMENTS_PENDING", label: "Documents Pending" },
  { value: "DOCUMENTS_UNDER_REVIEW", label: "Documents Under Review" }, { value: "HIRED", label: "Hired" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

export default function Submissions({
  title = "Candidate Applications",
  subtitle = "Newly applied candidates from the Career Portal. Once HR progresses a candidate, the application leaves this list and moves to its next stage.",
  initialStatus = "",
  lockedStatus = false,
}: {
  title?: string;
  subtitle?: string;
  initialStatus?: string;
  lockedStatus?: boolean;
} = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [jobOpeningId, setJobOpeningId] = useState(() => searchParams.get("jobOpeningId") || "");
  const [status, setStatus] = useState(() => lockedStatus ? (initialStatus || searchParams.get("status") || "") : NEW_APPLICATION_STATUS);
  const [dateFrom, setDateFrom] = useState(() => searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(() => searchParams.get("dateTo") || "");
  const [page, setPage] = useState(() => Number(searchParams.get("page")) || 1);
  const [error, setError] = useState("");

  const [detail, setDetail] = useState<any>(null);
  const [cv, setCv] = useState<{ url: string; name: string; downloadUrl?: string } | null>(null);
  const [cvBusy, setCvBusy] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyStatus, setBusyStatus] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search);
  const effectiveStatus = lockedStatus ? initialStatus : status;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, jobOpeningId, effectiveStatus, dateFrom, dateTo]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedSearch) next.set("search", debouncedSearch);
    if (jobOpeningId) next.set("jobOpeningId", jobOpeningId);
    if (effectiveStatus) next.set("status", effectiveStatus);
    if (dateFrom) next.set("dateFrom", dateFrom);
    if (dateTo) next.set("dateTo", dateTo);
    if (page > 1) next.set("page", String(page));
    setSearchParams(next, { replace: true });
  }, [debouncedSearch, jobOpeningId, effectiveStatus, dateFrom, dateTo, page, setSearchParams]);

  const params = useMemo(
    () => ({ page, pageSize: 10, search: debouncedSearch || undefined, jobOpeningId: jobOpeningId || undefined, status: effectiveStatus || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
    [page, debouncedSearch, jobOpeningId, effectiveStatus, dateFrom, dateTo],
  );

  const { data, isLoading, refetch } = useApiQuery<any>(
    queryKeys.applications(params),
    () => hrApi.applications(params).then((r: any) => r?.data),
  );
  const items = Array.isArray(data) ? data : data?.items ?? [];
  const pagination = { total: Number(data?.total ?? items.length), page: Number(data?.page ?? page), pageSize: Number(data?.pageSize ?? 10), totalPages: Number(data?.totalPages ?? Math.max(1, Math.ceil(items.length / 10) || 1)) };
  const from = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const to = Math.min(pagination.page * pagination.pageSize, pagination.total);

  const { data: openings = [] } = useApiQuery<any[]>(
    queryKeys.openings({ dropdown: true }),
    () => hrApi.openings({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? []),
  );

  const openDetail = async (row: any) => {
    setDetailLoading(true);
    setDetail(row);
    try {
      const res = await hrApi.application(row.id);
      const full = res?.data?.item ?? res?.data;
      if (full) setDetail(full);
    } catch {
      // List data is already loaded; keep it visible if the full record cannot be fetched.
    } finally {
      setDetailLoading(false);
    }
  };

  const changeStatus = async (status: string) => {
    if (!detail) return;
    const label = APPLICATION_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
    if (["HIRED", "WITHDRAWN"].includes(status) && !window.confirm(`${label} this application? This cannot be undone.`)) return;
    const remarks = status === "REJECTED"
      ? window.prompt("Reason for rejection:", "Rejected by HR")
      : `Moved to ${label} by HR`;
    if (remarks === null) return;
    setBusyStatus(status);
    setError("");
    try {
      await hrApi.applicationStatus(detail.id, { status, remarks });
      setDetail((current: any) => (current ? { ...current, status } : current));
      await refetch();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not change the application status.");
    } finally {
      setBusyStatus(null);
    }
  };

  const activeChips = [
    debouncedSearch ? { key: "search", label: `Search: ${debouncedSearch}`, clear: () => setSearch("") } : null,
    jobOpeningId ? { key: "jobOpeningId", label: `Position: ${openings.find((o: any) => o.id === jobOpeningId)?.title || "Selected"}`, clear: () => setJobOpeningId("") } : null,
    lockedStatus && effectiveStatus ? { key: "status", label: `Status: ${LABELS.find((o) => o.value === effectiveStatus)?.label || effectiveStatus}`, clear: () => setStatus("") } : null,
    dateFrom ? { key: "dateFrom", label: `From: ${dateFrom}`, clear: () => setDateFrom("") } : null,
    dateTo ? { key: "dateTo", label: `To: ${dateTo}`, clear: () => setDateTo("") } : null,
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;

  const clearFilters = () => {
    setSearch("");
    setJobOpeningId("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
  };

  const openResume = async (fileId?: string) => {
    if (!fileId) return;
    setCvBusy(true);
    setError("");
    try {
      const tokenRes = await hrApi.fileAccessToken(fileId);
      const token = tokenRes?.data?.token;
      if (token) {
        const blobRes = await hrApi.file(fileId, token);
        const url = URL.createObjectURL(blobRes.data as Blob);
        setCv({ url, name: "Candidate resume" });
      } else {
        setCv({ url: tokenRes?.data?.url, name: "Candidate resume", downloadUrl: tokenRes?.data?.url });
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Cannot open the CV.");
    } finally {
      setCvBusy(false);
    }
  };

  const columns: Column<any>[] = [
    {
      key: "candidate",
      header: "Candidate",
      className: "col-candidate",
      render: (a) => (
        <div className="cell-user">
          <div className="avatar">{initials(a.candidate?.fullName || "")}</div>
          <div className="cell-user__text">
            <button type="button" className="ta-link cell-user__name" onClick={() => void openDetail(a)} aria-label={`Open the application of ${a.candidate?.fullName}`}>{a.candidate?.fullName}</button>
            <div className="cell-user__sub">{a.candidate?.candidateCode || "No candidate ID"} · {a.candidate?.email}</div>
          </div>
        </div>
      ),
    },
    { key: "application", header: "Application ID", className: "col-application", render: (a) => <div className="cell-stack"><strong>{a.applicationCode}</strong><span className="cell-muted">Applied {formatDate(a.appliedAt)}</span></div> },
    { key: "email", header: "Email", className: "col-email", render: (a) => <span className="cell-ellipsis" title={a.candidate?.email}>{a.candidate?.email}</span> },
    { key: "phone", header: "Phone", className: "col-phone", render: (a) => <span className="cell-nowrap">{a.candidate?.mobile || "—"}</span> },
    { key: "position", header: "Position", className: "col-position", render: (a) => <div className="cell-stack"><strong>{a.jobOpening?.title}</strong><span className="cell-muted">{a.jobOpening?.department?.name || "—"}</span></div> },
    { key: "experience", header: "Exp.", className: "col-compact", render: (a) => <span className="cell-nowrap">{a.candidate?.totalExperience != null ? `${a.candidate.totalExperience} yrs` : "—"}</span> },
    { key: "status", header: "Status", className: "col-status", render: (a) => <CandidateStatusBadge status={a.status} /> },
    {
      key: "actions",
      header: "Actions",
      className: "text-right col-actions",
      render: (a) => (
        <div className="cell-actions cell-actions--nowrap">
          <button type="button" className="btn btn--ghost btn--icon" title="View application details" aria-label={`View application details of ${a.candidate?.fullName}`} onClick={() => void openDetail(a)}><Eye size={16} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Ecometrix · Talent Acquisition"
        title={title}
        subtitle={subtitle}
        actions={<Button variant="outline" icon={RefreshCw} onClick={() => void refetch()}>Refresh data</Button>}
      />

      {error && <div className="notice notice--error" role="alert"><div className="notice__body">{error}</div></div>}

      <section className="ta-applications-toolbar" aria-label="Application filters">
        <div className="ta-applications-toolbar__row">
          <div className="search-box ta-applications-toolbar__search">
            <span className="search-box__icon"><Search size={16} aria-hidden="true" /></span>
            <input
              type="search"
              className="input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search candidate name, email or application ID..."
              aria-label="Search candidates"
            />
          </div>
          <div className="ta-position-filter">
            <label className="ta-position-filter__label" htmlFor="applications-position"><Briefcase size={15} aria-hidden="true" /> Position</label>
            <Select id="applications-position" aria-label="Filter by position" value={jobOpeningId} onChange={(event) => setJobOpeningId(event.target.value)} placeholder="All Positions" options={openings.map((o: any) => ({ value: o.id, label: o.title }))} />
          </div>
          {!lockedStatus && <span className="filters-summary">New applications only</span>}
          <label className="ta-inline-field"><span className="ta-inline-field__label">From</span><input type="date" className="input" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} aria-label="Applications from date" /></label>
          <label className="ta-inline-field"><span className="ta-inline-field__label">To</span><input type="date" className="input" value={dateTo} onChange={(event) => setDateTo(event.target.value)} aria-label="Applications to date" /></label>
        </div>
        {activeChips.length > 0 ? (
          <div className="ta-applications-toolbar__active">
            <span className="filters-summary"><SlidersHorizontal size={13} aria-hidden="true" /> Active filters</span>
            <ul className="ta-active-filters" aria-label="Active filters">
              {activeChips.map((chip) => (
                <li key={chip.key}><button type="button" className="ta-active-filter" onClick={chip.clear} aria-label={`Remove filter ${chip.label}`}>{chip.label}<X size={12} aria-hidden="true" /></button></li>
              ))}
            </ul>
            <div className="ta-applications-toolbar__spacer" />
            <span className="ta-applications-toolbar__count" aria-live="polite">{items.length} matching application{items.length === 1 ? "" : "s"}</span>
            <Button variant="ghost" size="sm" icon={X} onClick={clearFilters}>Clear Filters</Button>
          </div>
        ) : (
          <div className="ta-applications-toolbar__meta">
            <span className="filters-summary"><SlidersHorizontal size={13} aria-hidden="true" /> All applications shown</span>
            <div className="ta-applications-toolbar__spacer" />
            <span className="ta-applications-toolbar__count" aria-live="polite">{pagination.total} application{pagination.total === 1 ? "" : "s"}</span>
          </div>
        )}
      </section>

      <div className="candidate-applications-table-wrap">
      <DataTable
        columns={columns}
        rows={items}
        rowKey={(row) => row.id}
        loading={isLoading}
        empty={<EmptyState icon={FileSearch} title="No applications match your filters" description="Adjust the search terms or clear the filters to see every application received through the Career Portal." />}
        mobileTitle={(row) => row.candidate?.fullName}
        mobileMeta={(row) => <>{row.applicationCode} · {row.jobOpening?.title}<br />{row.candidate?.email} · {row.candidate?.mobile || "—"}</>}
        mobileActions={(row) => (
          <Button size="sm" variant="outline" icon={Eye} onClick={() => void openDetail(row)}>Details</Button>
        )}
        footer={<><span>Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{pagination.total}</strong> application{pagination.total === 1 ? "" : "s"}</span><span className="cell-muted">Applied date · newest first</span><div className="ta-pagination"><button type="button" className="btn btn--outline btn--sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={pagination.page <= 1}>Previous</button><span className="ta-pagination__status">Page {pagination.page} of {pagination.totalPages}</span><button type="button" className="btn btn--outline btn--sm" onClick={() => setPage(Math.min(pagination.totalPages, page + 1))} disabled={pagination.page >= pagination.totalPages}>Next</button></div></>}
      />
      </div>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Application details"
        subtitle={detail ? `${detail.candidate?.fullName} · ${detail.applicationCode}` : undefined}
        size="xl"
        footer={detail ? <Button variant="outline" onClick={() => setDetail(null)}>Close</Button> : undefined}
      >
        {detail && (
          <div className="space-y-4">
            <div className="profile-hero card" style={{ padding: "1rem" }}>
              <div className="avatar avatar--lg">{initials(detail.candidate?.fullName || "")}</div>
              <div className="profile-hero__identity">
                <h3 className="profile-hero__name">{detail.candidate?.fullName}</h3>
                <p className="profile-hero__role">{detail.jobOpening?.title} · {detail.jobOpening?.department?.name || "—"}</p>
                <div className="profile-hero__contacts"><span><Briefcase size={14} aria-hidden="true" /> {detail.candidate?.totalExperience ?? 0} yrs experience</span><span><RefreshCw size={14} aria-hidden="true" /> Applied {formatDate(detail.appliedAt)}</span></div>
              </div>
              <div className="profile-hero__meta"><CandidateStatusBadge status={detail.status} /><div><span className="detail-item__label">AI Score</span><strong>{detail.aiMatchScore != null ? Math.round(detail.aiMatchScore) : "—"}</strong></div></div>
            </div>
            <div className="detail-grid detail-grid--3">
              <div className="detail-item"><div className="detail-item__label">Candidate ID</div><div className="detail-item__value">{detail.candidate?.candidateCode || "—"}</div></div>
              <div className="detail-item"><div className="detail-item__label">Application ID</div><div className="detail-item__value">{detail.applicationCode}</div></div>
              <div className="detail-item"><div className="detail-item__label">Email</div><div className="detail-item__value">{detail.candidate?.email || "—"}</div></div>
              <div className="detail-item"><div className="detail-item__label">Phone</div><div className="detail-item__value">{detail.candidate?.mobile || "—"}</div></div>
              <div className="detail-item"><div className="detail-item__label">Total experience</div><div className="detail-item__value">{detail.candidate?.totalExperience ?? "—"} yrs</div></div>
              <div className="detail-item"><div className="detail-item__label">Source</div><div className="detail-item__value">{detail.source || "Career Portal"}</div></div>
              <div className="detail-item"><div className="detail-item__label">Application status</div><div className="detail-item__value"><CandidateStatusBadge status={detail.status} /></div></div>
              {detail.hrRemarks && <div className="detail-item" style={{ gridColumn: "1 / -1" }}><div className="detail-item__label">HR Remarks</div><div className="detail-item__value">{detail.hrRemarks}</div></div>}
            </div>
            <div className="detail-section">
              <h4 className="detail-section__title">Application actions</h4>
              <p className="detail-item__value detail-item__value--muted" style={{ marginBottom: "0.5rem" }}>
                Move this application to the next recruitment stage.
              </p>
              <div className="flex flex-wrap gap-2">
                {(APPLICATION_TRANSITIONS[detail.status] ?? []).map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={status === "REJECTED" ? "danger-ghost" : status === "WITHDRAWN" ? "ghost" : "outline"}
                    onClick={() => void changeStatus(status)}
                    disabled={Boolean(busyStatus)}
                    loading={busyStatus === status}
                  >
                    {APPLICATION_STATUS_LABELS[status] ?? status.replace(/_/g, " ")}
                  </Button>
                ))}
                {(APPLICATION_TRANSITIONS[detail.status] ?? []).length === 0 && (
                  <span className="cell-muted">No further transitions are available from this stage.</span>
                )}
                <Link className="btn btn--ghost btn--sm" to={`/hr/submissions/${detail.id}`}>Open full profile</Link>
              </div>
            </div>
            {detailLoading && <div className="notice notice--info"><div className="notice__body">Refreshing the full candidate record…</div></div>}
            {detail.candidate?.skills?.length > 0 && (
              <div className="detail-section">
                <h4 className="detail-section__title">Skills</h4>
                <div className="flex flex-wrap gap-2">{detail.candidate.skills.map((record: any) => <Badge key={record.id} variant="blue">{record.skill?.name || "Skill"}{record.level ? ` · ${record.level}` : ""}</Badge>)}</div>
              </div>
            )}
            {detail.candidate?.employmentHistory?.length > 0 && (
              <div className="detail-section">
                <h4 className="detail-section__title">Employment History</h4>
                <ul className="history-timeline">
                  {detail.candidate.employmentHistory.map((record: any) => (
                    <li className="history-timeline__item" key={record.id}>
                      <span className="history-timeline__marker" />
                      <div><div className="history-timeline__role">{record.title || "Role"} · {record.organization}</div><div className="history-timeline__dates">{record.startDate ? new Date(record.startDate).getFullYear() : ""}{record.endDate ? ` → ${new Date(record.endDate).getFullYear()}` : " → Present"}{record.description ? ` · ${record.description}` : ""}</div></div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {detail.candidate?.certifications?.length > 0 && (
              <div className="detail-section">
                <h4 className="detail-section__title">Certifications</h4>
                <div className="flex flex-wrap gap-2">{detail.candidate.certifications.map((record: any) => <Badge key={record.id} variant="purple">{record.name}</Badge>)}</div>
              </div>
            )}
            {detail.coverLetter && (
              <div className="detail-section">
                <h4 className="detail-section__title">Cover letter</h4>
                <div className="card" style={{ whiteSpace: "pre-wrap", padding: "0.85rem 1rem", fontSize: "0.84rem", lineHeight: 1.6 }}>{detail.coverLetter}</div>
              </div>
            )}
            {detail.remarks?.length > 0 && (
              <div className="detail-section">
                <h4 className="detail-section__title">HR remarks log</h4>
                <ul className="history-timeline">
                  {detail.remarks.map((entry: any) => (
                    <li className="history-timeline__item" key={entry.id}>
                      <span className="history-timeline__marker" />
                      <div><div className="history-timeline__role">{entry.body}</div><div className="history-timeline__dates">{formatDateTime(entry.createdAt)}{entry.author?.email ? ` · ${entry.author.email}` : ""}</div></div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {detail.documents?.length > 0 && (
              <div className="detail-section">
                <h4 className="detail-section__title">Documents</h4>
                <div className="detail-grid detail-grid--3">
                  {detail.documents.map((record: any) => (
                    <div className="detail-item" key={record.id}>
                      <div className="detail-item__label">{record.category?.name || "Document"}</div>
                      <div className="detail-item__value">
                        {record.status}
                        {record.fileId && <button type="button" className="ta-link" style={{ marginLeft: "0.5rem" }} onClick={() => void openResume(record.fileId)}>Preview</button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {detail.resumeFileId && (
              <div className="cv-file">
                <span className="cv-file__icon"><FileSearch size={22} aria-hidden="true" /></span>
                <div className="cv-file__info"><div className="cv-file__name">Candidate resume</div><div className="cv-file__meta">Uploaded through the Career Portal</div></div>
                <button type="button" className="btn btn--outline" onClick={() => void openResume(detail.resumeFileId)} disabled={cvBusy}><Eye size={16} aria-hidden="true" /> Preview</button>
              </div>
            )}
            {detail.statusHistory?.length > 0 && (
              <div className="detail-section">
                <h4 className="detail-section__title">Status history</h4>
                <ul className="history-timeline">
                  {detail.statusHistory.map((entry: any) => (
                    <li className="history-timeline__item" key={entry.id}><span className="history-timeline__marker" /><div><div className="history-timeline__role">{entry.fromStatus ? `${entry.fromStatus} → ` : ""}{entry.toStatus}</div><div className="history-timeline__dates">{formatDateTime(entry.createdAt)}{entry.remarks ? ` · ${entry.remarks}` : ""}</div></div></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(cv)}
        onClose={() => { if (cv?.url?.startsWith("blob:")) URL.revokeObjectURL(cv.url); setCv(null); }}
        title="Candidate resume"
        size="lg"
        footer={<Button onClick={() => { if (cv?.url) window.open(cv.downloadUrl ?? cv.url, "_blank"); }}><Download size={16} aria-hidden="true" /> Download / open</Button>}
      >
        {cv && <iframe title="Candidate resume" src={cv.url} style={{ width: "100%", height: 520, border: 0 }} />}
      </Modal>
    </div>
  );
}
