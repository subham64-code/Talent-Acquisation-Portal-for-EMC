import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, FileText, UserRound, UserPlus } from "lucide-react";
import DataTable, { type Column } from "../../../components/DataTable";
import Badge from "../../../components/ref/Badge";
import Button from "../../../components/ref/Button";
import Modal from "../../../components/ref/Modal";
import { Select } from "../../../components/ref/Input";
import DatabankToolbar from "./DatabankToolbar";
import { EmptyStateBlock, formatDate, initials } from "./shared";
import { hrApi } from "../../../lib/api";
import { useApiQuery, useInvalidate } from "../../../hooks/useApiQuery";

const PIPELINE_STATUSES = [
  "APPLIED",
  "UNDER_REVIEW",
  "AI_RECOMMENDED",
  "SHORTLISTED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "SELECTED",
  "REJECTED",
  "ON_HOLD",
  "OFFER_SENT",
  "OFFER_ACCEPTED",
  "DOCUMENTS_PENDING",
  "DOCUMENTS_UNDER_REVIEW",
];

const STATUS_OPTIONS = [
  { value: "APPLIED", label: "Applied" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "AI_RECOMMENDED", label: "AI Recommended" },
  { value: "SHORTLISTED", label: "Shortlisted" },
  { value: "INTERVIEW_SCHEDULED", label: "Interview Scheduled" },
  { value: "INTERVIEW_COMPLETED", label: "Interview Completed" },
  { value: "SELECTED", label: "Selected" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "OFFER_SENT", label: "Offer Sent" },
  { value: "OFFER_ACCEPTED", label: "Offer Accepted" },
  { value: "DOCUMENTS_PENDING", label: "Documents Pending" },
  { value: "DOCUMENTS_UNDER_REVIEW", label: "Documents Under Review" },
];

const STATUS_VARIANT: Record<string, "green" | "orange" | "red" | "grey"> = {
  SHORTLISTED: "green",
  SELECTED: "green",
  OFFER_ACCEPTED: "green",
  REJECTED: "red",
  ON_HOLD: "orange",
  INTERVIEW_SCHEDULED: "orange",
  DOCUMENTS_PENDING: "orange",
  DOCUMENTS_UNDER_REVIEW: "orange",
};

export default function PipelinedView() {
  const invalidate = useInvalidate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [positionId, setPositionId] = useState("");
  const [target, setTarget] = useState<any>(null);
  const [jobId, setJobId] = useState("");
  const [shortlist, setShortlist] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const { data: rows = [], isLoading } = useApiQuery<any[]>(
    ["pipelined-applications", { search, status, positionId }],
    () => hrApi.applications({
      page: 1,
      pageSize: 100,
      status: status || PIPELINE_STATUSES.join(","),
      search: search || undefined,
      jobOpeningId: positionId || undefined,
    }).then((r: any) => r?.data?.items ?? []),
  );

  const { data: positions = [] } = useApiQuery<any[]>(
    ["openings", "all"],
    () => hrApi.openings({ page: 1, pageSize: 200 }).then((r: any) => r?.data?.items ?? []),
  );

  const clear = () => {
    setSearch("");
    setStatus("");
    setPositionId("");
  };

  const openAssign = (row: any) => {
    setTarget(row);
    setJobId("");
    setShortlist(true);
    setError("");
    setNotice("");
  };

  const assign = async () => {
    if (!target || !jobId) return;
    setBusyId(target.id);
    setError("");
    setNotice("");
    try {
      const res = await hrApi.assignApplicationToJob(target.id, { jobOpeningId: jobId, shortlist });
      setNotice((res as any)?.data?.message || `${target.candidate?.fullName} was assigned to the selected position.`);
      setTarget(null);
      invalidate(["pipelined-applications", "applications", "shortlisting", "dashboard"]);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "The candidate could not be assigned to that position.");
    } finally {
      setBusyId(null);
    }
  };

  const columns: Column<any>[] = [
    {
      key: "candidate",
      header: "Candidate",
      render: (row) => (
        <div className="cell-user">
          <div className="avatar">{initials(row.candidate?.fullName || "")}</div>
          <div className="cell-user__text">
            <div className="cell-user__name">{row.candidate?.fullName}</div>
            <div className="cell-user__sub">{row.candidate?.candidateCode || row.candidate?.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "position",
      header: "Applied Position",
      render: (row) => (
        <div>
          <div>{row.jobOpening?.title || "—"}</div>
          <div className="cell-muted">{row.applicationCode}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <Badge variant={STATUS_VARIANT[row.status] ?? "grey"} dot>{STATUS_OPTIONS.find((option) => option.value === row.status)?.label ?? row.status}</Badge>,
    },
    { key: "applied", header: "Applied On", render: (row) => <span className="cell-muted">{formatDate(row.appliedAt)}</span> },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (row) => (
        <div className="cell-actions">
          <Link className="btn btn--ghost btn--icon" to={`/hr/submissions/${row.id}`} title="View candidate profile" aria-label="View candidate profile"><UserRound size={16} /></Link>
          <Button variant="outline" size="sm" icon={UserPlus} onClick={() => openAssign(row)} type="button" disabled={Boolean(busyId)}>Assign to position</Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="notice notice--info">
        <span className="notice__icon"><CheckCircle2 size={18} aria-hidden="true" /></span>
        <div className="notice__body"><div className="notice__title">Pipelined employees</div>Candidates across all hiring stages, including rejected ones. Assign a candidate to another position for future openings and optionally add them straight to that position's shortlist.</div>
      </div>

      {notice && <div className="notice notice--success" role="status"><div className="notice__body">{notice}</div></div>}
      {error && <div className="notice notice--error" role="alert"><div className="notice__body">{error}</div></div>}

      <DatabankToolbar
        search={search}
        onSearch={setSearch}
        searchLabel="Search pipelined employees"
        searchPlaceholder="Search by candidate, application ID or position…"
        filters={[
          { key: "status", label: "Statuses", placeholder: "All Statuses", value: status, onChange: setStatus, options: STATUS_OPTIONS },
          { key: "position", label: "Positions", placeholder: "All Positions", value: positionId, onChange: setPositionId, options: positions.map((position: any) => ({ value: position.id, label: `${position.title} (${position.jobCode ?? ""})` })) },
        ]}
        onClear={clear}
      >
        <span className="filters-summary">{isLoading ? "Loading candidates…" : `${rows.length} candidate${rows.length === 1 ? "" : "s"}`}</span>
      </DatabankToolbar>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={isLoading}
        empty={<EmptyStateBlock icon={FileText} title="No pipelined candidates" description="Candidates in the hiring pipeline, including rejected ones, will appear here." />}
        footer={<><span>Showing <strong>{rows.length}</strong> pipelined candidate{rows.length === 1 ? "" : "s"}</span><span className="cell-muted">Assign candidates to future positions when needed</span></>}
      />

      <Modal
        open={Boolean(target)}
        onClose={() => (busyId ? undefined : setTarget(null))}
        title="Assign to another position"
        subtitle={target ? `${target.candidate?.fullName} · currently applied to ${target.jobOpening?.title ?? "—"}` : undefined}
        size="sm"
        footer={(
          <>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={Boolean(busyId)}>Cancel</Button>
            <Button icon={UserPlus} onClick={() => void assign()} loading={Boolean(busyId)} disabled={!jobId}>Assign</Button>
          </>
        )}
      >
        <Select
          label="Position"
          value={jobId}
          onChange={(event) => setJobId(event.target.value)}
          options={positions
            .filter((position: any) => position.id !== target?.jobOpeningId)
            .map((position: any) => ({ value: position.id, label: `${position.title} (${position.jobCode ?? ""})` }))}
          placeholder="Select a position"
        />
        <label className="review-diff__flag" style={{ marginTop: "1rem" }}>
          <input type="checkbox" checked={shortlist} onChange={(event) => setShortlist(event.target.checked)} /> Add to this position's shortlist
        </label>
      </Modal>
    </div>
  );
}
