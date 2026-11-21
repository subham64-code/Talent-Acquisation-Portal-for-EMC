import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, CheckCircle2, Download, FileSearch, Mail, PauseCircle, Phone, PlayCircle, UserRound, XCircle } from "lucide-react";
import PageHeader from "../../../components/ref/PageHeader";
import Button from "../../../components/ref/Button";
import Modal from "../../../components/ref/Modal";
import EmptyState from "../../../components/ref/EmptyState";
import DataTable, { type Column } from "../../../components/DataTable";
import CandidateStatusBadge from "../../../components/ref/CandidateStatusBadge";
import { formatDate, initials } from "./shared";
import { hrApi } from "../../../lib/api";
import { useApiQuery, useInvalidate } from "../../../hooks/useApiQuery";

export default function HoldView() {
  const invalidate = useInvalidate();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const { data: items = [], isLoading } = useApiQuery<any[]>(
    ["applications", "hold"],
    () => hrApi.applications({ page: 1, pageSize: 100, status: "ON_HOLD" }).then((r: any) => r?.data?.items ?? []),
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item: any) =>
      [item.candidate?.fullName, item.candidate?.email, item.candidate?.mobile, item.jobOpening?.title, item.applicationCode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [items, search]);

  const action = async (item: any, next: "UNDER_REVIEW" | "REJECTED" | "SELECTED") => {
    setBusyId(item.id);
    setError("");
    try {
      const remarks = next === "UNDER_REVIEW" ? "Resumed from hold by HR." : next === "REJECTED" ? "Rejected after hold review." : "Selected after hold review.";
      await hrApi.applicationStatus(item.id, { status: next, remarks });
      setNotice(next === "UNDER_REVIEW" ? `${item.candidate?.fullName} was resumed to review.` : next === "REJECTED" ? `${item.candidate?.fullName} was rejected.` : `${item.candidate?.fullName} was selected.`);
      invalidate(["applications", "dashboard", "offers"]);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "The action failed.");
    } finally {
      setBusyId(null);
    }
  };

  const previewCv = async (item: any) => {
    const fileId = item.resumeFileId;
    if (!fileId) return;
    setPreviewing(true);
    setError("");
    try {
      const r = await hrApi.fileAccessToken(fileId);
      const token = r?.data?.token;
      if (token) {
        const blobRes = await hrApi.file(fileId, token);
        if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blobRes.data as Blob));
      } else if (r?.data?.url) {
        setPreviewUrl(r.data.url);
      }
    } catch {
      setError("Could not open the CV.");
    } finally {
      setPreviewing(false);
    }
  };

  const closePreview = () => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const actionButton = (item: any) => (
    <div className="cell-actions">
      <Link className="btn btn--ghost btn--icon" to={`/hr/submissions/${item.id}`} title="Open candidate profile" aria-label="Open candidate profile"><UserRound size={16} /></Link>
      {item.resumeFileId && <button type="button" className="btn btn--ghost btn--icon" title="Preview CV" aria-label="Preview CV" onClick={() => void previewCv(item)} disabled={previewing}><FileSearch size={16} /></button>}
      <button type="button" className="btn btn--ghost btn--icon" title="Select candidate" aria-label="Select candidate" onClick={() => void action(item, "SELECTED")} disabled={busyId === item.id}><CheckCircle2 size={16} /></button>
      <button type="button" className="btn btn--ghost btn--icon" title="Resume candidate" aria-label="Resume candidate" onClick={() => void action(item, "UNDER_REVIEW")} disabled={busyId === item.id}><PlayCircle size={16} /></button>
      <button type="button" className="btn btn--danger-ghost btn--icon" title="Reject candidate" aria-label="Reject candidate" onClick={() => void action(item, "REJECTED")} disabled={busyId === item.id}><XCircle size={16} /></button>
    </div>
  );

  const columns: Column<any>[] = [
    {
      key: "candidate",
      header: "Candidate",
      render: (item) => (
        <div className="cell-user">
          <div className="avatar">{initials(item.candidate?.fullName || "")}</div>
          <div className="cell-user__text">
            <Link className="cell-user__name ta-link" to={`/hr/submissions/${item.id}`}>{item.candidate?.fullName}</Link>
            <div className="cell-user__sub">{item.candidate?.email}</div>
          </div>
        </div>
      ),
    },
    { key: "application", header: "Application ID", render: (item) => <span className="cell-strong">{item.applicationCode}</span> },
    { key: "position", header: "Position", render: (item) => <div><div>{item.jobOpening?.title}</div><div className="cell-muted">{item.jobOpening?.department?.name || "—"}</div></div> },
    { key: "applied", header: "Applied", render: (item) => <span className="cell-muted">{formatDate(item.appliedAt)}</span> },
    { key: "score", header: "AI Score", render: (item) => item.aiMatchScore != null ? <span className="cell-strong">{Math.round(item.aiMatchScore)}</span> : <span className="cell-muted">—</span> },
    { key: "status", header: "Status", render: (item) => <CandidateStatusBadge status={item.status} /> },
    { key: "actions", header: "Actions", className: "text-right", render: actionButton },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Employee databank / hold"
        title="On Hold"
        subtitle="Candidates placed on hold across the recruitment pipeline. Review the full profile, preview the CV and select, reject or resume them."
      />

      {notice && <div className="notice notice--success" role="status"><div className="notice__body">{notice}</div></div>}
      {error && <div className="notice notice--error" role="alert"><div className="notice__body">{error}</div></div>}

      <div className="page-toolbar">
        <div className="search-box">
          <span className="search-box__icon"><PauseCircle size={16} aria-hidden="true" /></span>
          <input type="search" className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by candidate, email, application ID or position…" aria-label="Search on hold candidates" />
        </div>
        <div className="page-toolbar__spacer" />
        <span className="filters-summary">{isLoading ? "Loading…" : `${filtered.length} on hold`}</span>
        <div className="view-toggle" role="group" aria-label="Switch hold view">
          <button type="button" className={`view-toggle__btn ${viewMode === "table" ? "active" : ""}`} onClick={() => setViewMode("table")} aria-pressed={viewMode === "table"}>Table</button>
          <button type="button" className={`view-toggle__btn ${viewMode === "cards" ? "active" : ""}`} onClick={() => setViewMode("cards")} aria-pressed={viewMode === "cards"}>Cards</button>
        </div>
      </div>

      {viewMode === "table" ? (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          loading={isLoading}
          empty={<EmptyState icon={PauseCircle} title="No candidates on hold" description="Candidates placed on hold appear here so HR can review them and act." />}
          footer={<><span>Showing <strong>{filtered.length}</strong> on hold</span><span className="cell-muted">Candidate profile opens full details + CV</span></>}
        />
      ) : (
        <div className="employee-card-grid">
          {filtered.map((item) => (
            <article className="employee-card" key={item.id}>
              <div className="employee-card__top">
                <div className="avatar avatar--lg">{initials(item.candidate?.fullName || "")}</div>
                <div className="employee-card__identity">
                  <h3 className="employee-card__name"><Link className="ta-link" to={`/hr/submissions/${item.id}`}>{item.candidate?.fullName}</Link></h3>
                  <p className="employee-card__role">{item.jobOpening?.title}</p>
                  <p className="employee-card__dept">{item.applicationCode}</p>
                </div>
                <CandidateStatusBadge status="ON_HOLD" />
              </div>
              <div className="employee-card__meta">
                <span className="employee-card__meta-item"><Mail size={14} aria-hidden="true" />{item.candidate?.email}</span>
                <span className="employee-card__meta-item"><Phone size={14} aria-hidden="true" />{item.candidate?.mobile || "—"}</span>
                <span className="employee-card__meta-item"><CalendarClock size={14} aria-hidden="true" />Applied {formatDate(item.appliedAt)}</span>
              </div>
              <div className="employee-card__footer">
                <span className="cell-muted">{item.candidate?.totalExperience ?? 0} yrs exp · AI {item.aiMatchScore != null ? Math.round(item.aiMatchScore) : "—"}</span>
                {actionButton(item)}
              </div>
            </article>
          ))}
          {!isLoading && filtered.length === 0 && <div className="card" style={{ gridColumn: "1 / -1" }}><EmptyState icon={PauseCircle} title="No candidates on hold" description="Candidates placed on hold appear here so HR can review them and act." /></div>}
        </div>
      )}

      <Modal
        open={Boolean(previewUrl)}
        onClose={closePreview}
        title="Candidate CV"
        size="lg"
        footer={<Button icon={Download} onClick={() => previewUrl && window.open(previewUrl, "_blank", "noreferrer")} loading={previewing}>Open</Button>}
      >
        {previewUrl && <iframe title="Candidate CV" src={previewUrl} style={{ width: "100%", height: 520, border: 0 }} />}
      </Modal>
    </div>
  );
}
