import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarPlus, PauseCircle, RefreshCw, RotateCcw, Search, UserCheck, UserRound, XCircle } from "lucide-react";
import { hrApi } from "../../lib/api";
import PageHeader from "../../components/ref/PageHeader";
import Button from "../../components/ref/Button";
import Modal from "../../components/ref/Modal";
import Badge from "../../components/ref/Badge";

import EmptyState from "../../components/ref/EmptyState";
import DataTable, { type Column } from "../../components/DataTable";
import { Select, Textarea } from "../../components/ref/Input";
import { initials, formatDate } from "./databank/shared";


export default function Shortlisting() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<any[]>([]);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"shortlisted" | "on_hold" | "rejected" | "all">("shortlisted");
  const [positionId, setPositionId] = useState("");
  const [positions, setPositions] = useState<any[]>([]);
  const [actionMode, setActionMode] = useState<"hold" | "reject" | "resume" | null>(null);
  const [actionTarget, setActionTarget] = useState<any>(null);
  const [remarks, setRemarks] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const statuses = ["UNDER_REVIEW", "AI_RECOMMENDED", "SHORTLISTED", "ON_HOLD", "REJECTED"];
      const [items, appCodes, openings] = await Promise.all([
        hrApi.applications({ page: 1, pageSize: 100, status: statuses.join(","), jobOpeningId: positionId || undefined }).then((r: any) => r?.data?.items ?? []),
        hrApi.interviews({ page: 1, pageSize: 100, jobOpeningId: positionId || undefined }).then((r: any) => r?.data?.items ?? r?.data ?? []),
        hrApi.openings({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? []),
      ]);
      setQueue(Array.isArray(items) ? items : []);
      setInterviews(Array.isArray(appCodes) ? appCodes : []);
      setPositions(Array.isArray(openings) ? openings : []);
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not load the shortlisting queue.");
    } finally {
      setLoading(false);
    }
  };

  // Refetch when the selected position changes; the server applies the filter.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [positionId]);

  const interviewStatus = (applicationId: string) => {
    const list = interviews.filter((item: any) => item.applicationId === applicationId || item.application?.id === applicationId);
    if (list.some((item: any) => ["SCHEDULED", "RESCHEDULED"].includes(item.status))) return "scheduled";
    if (list.some((item: any) => item.status === "COMPLETED")) return "completed";
    return "Not scheduled";
  };

  const ranks = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const item of queue) {
      const key = item.jobOpeningId || item.jobOpening?.id || "unassigned";
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }
    const map = new Map<string, number>();
    for (const group of groups.values()) {
      const scored = group.filter((item) => Number.isFinite(Number(item.aiMatchScore))).sort((a, b) => Number(b.aiMatchScore) - Number(a.aiMatchScore));
      scored.forEach((item, index) => map.set(item.id, index + 1));
    }
    return map;
  }, [queue]);

  const pendingShortlist = queue.filter((item) => ["UNDER_REVIEW", "AI_RECOMMENDED"].includes(item.status));
  const entries = queue.filter((item) => ["SHORTLISTED", "ON_HOLD", "REJECTED"].includes(item.status));
  const counts = {
    shortlisted: entries.filter((item) => item.status === "SHORTLISTED").length,
    on_hold: entries.filter((item) => item.status === "ON_HOLD").length,
    rejected: entries.filter((item) => item.status === "REJECTED").length,
    all: entries.length,
  };

  const needle = search.trim().toLowerCase();
  const matchesSearch = (item: any) => !needle || [item.candidate?.fullName, item.candidate?.email, item.applicationCode, item.jobOpening?.title].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle));
  const matchesPosition = (item: any) => !positionId || item.jobOpeningId === positionId;
  const filterFor = (key: typeof statusFilter) => {
    if (key === "shortlisted") return entries.filter((item) => item.status === "SHORTLISTED" && matchesPosition(item) && matchesSearch(item));
    if (key === "on_hold") return entries.filter((item) => item.status === "ON_HOLD" && matchesPosition(item) && matchesSearch(item));
    if (key === "rejected") return entries.filter((item) => item.status === "REJECTED" && matchesPosition(item) && matchesSearch(item));
    return entries.filter((item) => matchesPosition(item) && matchesSearch(item));
  };
  const visible = filterFor(statusFilter);


  const shortlist = async (item: any) => {
    setBusyAction(`shortlist:${item.id}`);
    setError("");
    try {
      await hrApi.applicationStatus(item.id, { status: "SHORTLISTED", remarks: "Shortlisted after the CV screening." });
      setNotice(`${item.candidate?.fullName} was shortlisted. Opening interview management…`);
      navigate("/hr/interviews");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not shortlist the candidate.");
    } finally {
      setBusyAction(null);
    }
  };

  const runAction = async () => {
    if (!actionTarget || !actionMode) return;
    const remark = remarks.trim();
    setBusyAction(actionMode);
    setError("");
    try {
      if (actionMode === "hold") await hrApi.applicationStatus(actionTarget.id, { status: "ON_HOLD", remarks: remark || "Candidate placed on hold after screening." });
      else if (actionMode === "reject") await hrApi.applicationStatus(actionTarget.id, { status: "REJECTED", remarks: remark || "Candidate rejected at shortlisting." });
      else await hrApi.applicationStatus(actionTarget.id, { status: "UNDER_REVIEW", remarks: remark || "Candidate resumed by HR." });
      setNotice(actionMode === "reject" ? `${actionTarget.candidate?.fullName} was rejected.` : actionMode === "hold" ? `${actionTarget.candidate?.fullName} was placed on hold.` : `${actionTarget.candidate?.fullName} was resumed.`);
      setActionMode(null);
      setActionTarget(null);
      setRemarks("");
      await load(true);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "The action could not be completed.");
    } finally {
      setBusyAction(null);
    }
  };

  const pendingColumns: Column<any>[] = [
    { key: "candidate", header: "Candidate", render: (row) => <div className="cell-user"><div className="avatar">{initials(row.candidate?.fullName || "")}</div><div className="cell-user__text"><div className="cell-user__name">{row.candidate?.fullName}</div><div className="cell-user__sub">{row.applicationCode}</div></div></div> },
    { key: "position", header: "Position", render: (row) => <div><div>{row.jobOpening?.title || "—"}</div><div className="cell-muted">{row.jobOpening?.department?.name || "—"}</div></div> },
    { key: "experience", header: "Experience", render: (row) => row.candidate?.totalExperience != null ? `${row.candidate.totalExperience} yrs` : "—" },
    { key: "rank", header: "AI Rank", className: "text-right", render: (row) => Number.isFinite(ranks.get(row.id)) ? <span className="cell-strong">#{ranks.get(row.id)}</span> : <span className="cell-muted">—</span> },
    { key: "score", header: "AI Score", className: "text-right", render: (row) => Number.isFinite(Number(row.aiMatchScore)) ? <span className="cell-strong">{Math.round(Number(row.aiMatchScore))}%</span> : <span className="cell-muted">Awaiting AI Result</span> },
    { key: "screening", header: "Screening result", render: (row) => <div><div>{row.status === "AI_RECOMMENDED" ? "AI recommended" : "Passed"}</div><div className="cell-muted">{row.hrRemarks || "—"}</div></div> },
    { key: "completed", header: "Screening completed", render: (row) => <span className="cell-muted">{formatDate(row.updatedAt)}</span> },
    { key: "applied", header: "Applied", render: (row) => <span className="cell-muted">{formatDate(row.appliedAt)}</span> },
    { key: "actions", header: "Actions", render: (row) => <div className="cell-actions" style={{ justifyContent: "flex-start", gap: 8, paddingLeft: 8 }}><Link className="btn btn--ghost btn--icon" to={`/hr/submissions/${row.id}`} title="View candidate profile" aria-label="View candidate profile"><UserRound size={16} /></Link><Button variant="outline" size="sm" icon={UserCheck} onClick={() => shortlist(row)} loading={busyAction === `shortlist:${row.id}`} disabled={Boolean(busyAction)}>Shortlist</Button></div> },
  ];

  const columns: Column<any>[] = [
    { key: "candidate", header: "Candidate", render: (row) => <div className="cell-user"><div className="avatar">{initials(row.candidate?.fullName || "")}</div><div className="cell-user__text"><div className="cell-user__name">{row.candidate?.fullName}</div><div className="cell-user__sub">{row.applicationCode}</div></div></div> },
    { key: "position", header: "Position", render: (row) => <div><div>{row.jobOpening?.title || "—"}</div><div className="cell-muted">{row.applicationCode}</div></div> },
    { key: "screening", header: "Screening result", render: (row) => Number.isFinite(Number(row.aiMatchScore)) ? <span className="cell-strong">{Math.round(Number(row.aiMatchScore))}%</span> : <span className="cell-muted">Not scored</span> },
    { key: "remarks", header: "HR remarks", render: (row) => row.hrRemarks || <span className="cell-muted">—</span> },
    { key: "shortlistedAt", header: "Shortlisted on", render: (row) => <span className="cell-muted">{formatDate(row.updatedAt)}</span> },
    { key: "interview", header: "Interview", render: (row) => { const state = interviewStatus(row.id); return <Badge variant={state === "scheduled" ? "blue" : state === "completed" ? "green" : "grey"}>{state === "scheduled" ? "Scheduled" : state === "completed" ? "Completed" : "Not scheduled"}</Badge>; } },
    { key: "status", header: "Shortlist", render: (row) => { const status = row.status; const meta = status === "SHORTLISTED" ? { label: "Shortlisted", variant: "green" as const } : status === "ON_HOLD" ? { label: "On Hold", variant: "grey" as const } : { label: "Rejected", variant: "red" as const }; return <Badge variant={meta.variant} dot>{meta.label}</Badge>; } },
    { key: "actions", header: "Actions", render: (row) => <div className="cell-actions" style={{ justifyContent: "flex-start", gap: 8, paddingLeft: 8 }}>{row.status === "SHORTLISTED" && <button type="button" className="btn btn--ghost btn--icon" onClick={() => navigate("/hr/interviews")} title="Schedule interview" aria-label="Schedule interview"><CalendarPlus size={16} /></button>}{row.status === "ON_HOLD" ? <button type="button" className="btn btn--ghost btn--icon" onClick={() => { setActionMode("resume"); setActionTarget(row); setRemarks(""); }} title="Resume candidate" aria-label="Resume candidate"><RotateCcw size={16} /></button> : <button type="button" className="btn btn--ghost btn--icon" onClick={() => { setActionMode("hold"); setActionTarget(row); setRemarks(""); }} title="Put candidate on hold" aria-label="Put candidate on hold"><PauseCircle size={16} /></button>}<button type="button" className="btn btn--danger-ghost btn--icon" onClick={() => { setActionMode("reject"); setActionTarget(row); setRemarks(""); }} title="Reject candidate" aria-label="Reject candidate"><XCircle size={16} /></button></div> },
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Ecometrix · Talent Acquisition"
        title="Shortlisting"
        subtitle="Candidates that completed the CV screening. Shortlist them, keep them on hold or close their application before the interview stage."
        actions={<Button variant="outline" icon={RefreshCw} onClick={() => void load(true)}>Refresh data</Button>}
      />

      {notice && <div className="notice notice--success" role="status"><div className="notice__body">{notice}</div></div>}
      {error && <div className="notice notice--error" role="alert"><div className="notice__body">{error}</div></div>}

      <div className="page-toolbar page-toolbar--row">
        <Select aria-label="Position" value={positionId} onChange={(event) => setPositionId(event.target.value)} options={positions.map((o: any) => ({ value: o.id, label: `${o.title} (${o.jobCode ?? ""})` }))} placeholder="All positions" />
        <div className="search-box"><span className="search-box__icon"><Search size={16} aria-hidden="true" /></span><input type="search" className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by candidate, application ID or position" aria-label="Search the shortlist" /></div>
        <div className="filters">
          <button type="button" className={`ta-filter-chip ${statusFilter === "shortlisted" ? "active" : ""}`} onClick={() => setStatusFilter("shortlisted")}>Shortlisted <span className="ta-filter-chip__count">{counts.shortlisted}</span></button>
          <button type="button" className={`ta-filter-chip ${statusFilter === "on_hold" ? "active" : ""}`} onClick={() => setStatusFilter("on_hold")}>On hold <span className="ta-filter-chip__count">{counts.on_hold}</span></button>
          <button type="button" className={`ta-filter-chip ${statusFilter === "rejected" ? "active" : ""}`} onClick={() => setStatusFilter("rejected")}>Rejected <span className="ta-filter-chip__count">{counts.rejected}</span></button>
          <button type="button" className={`ta-filter-chip ${statusFilter === "all" ? "active" : ""}`} onClick={() => setStatusFilter("all")}>All <span className="ta-filter-chip__count">{counts.all}</span></button>
        </div>
      </div>

      {pendingShortlist.length > 0 && (
        <section className="card">
          <div className="card__header"><div><div className="card__title">Awaiting a shortlisting decision</div><div className="card__subtitle">Candidates that passed the CV screening and still need a shortlisting decision</div></div></div>
          <div className="card__body"><DataTable columns={pendingColumns} rows={[...pendingShortlist].sort((a, b) => Number(b.aiMatchScore ?? -1) - Number(a.aiMatchScore ?? -1))} rowKey={(row) => row.id} loading={loading} empty={<EmptyState icon={UserCheck} title="No candidate is waiting for a shortlisting decision" description="Candidates that pass the CV screening appear here for the shortlisting decision." />} /></div>
        </section>
      )}

      <DataTable columns={columns} rows={visible} rowKey={(row) => row.id} loading={loading} empty={<EmptyState icon={UserCheck} title="No shortlist records in this view" description="Candidates appear here once their CV screening is completed and they are shortlisted." />} footer={<><span>Showing <strong>{visible.length}</strong> candidate{visible.length === 1 ? "" : "s"}</span><span className="cell-muted">Interview status reads from live interview records</span></>} />

      <Modal
        open={Boolean(actionMode)}
        onClose={() => (busyAction ? undefined : setActionMode(null))}
        title={actionMode === "reject" ? "Reject candidate" : actionMode === "hold" ? "Put candidate on hold" : "Resume candidate"}
        subtitle={actionTarget ? `${actionTarget.candidate?.fullName} · ${actionTarget.jobOpening?.title}` : ""}
        size="sm"
        footer={<><Button variant="outline" onClick={() => setActionMode(null)} disabled={Boolean(busyAction)}>Cancel</Button><Button variant={actionMode === "reject" ? "danger" : "primary"} onClick={() => void runAction()} loading={busyAction === actionMode} disabled={(actionMode === "reject" && !remarks.trim()) || Boolean(busyAction)}>{actionMode === "reject" ? "Reject candidate" : actionMode === "hold" ? "Put on hold" : "Resume candidate"}</Button></>}
      >
        <Textarea label={actionMode === "reject" ? "Reason for rejection" : actionMode === "hold" ? "Reason for the hold" : "Reason for the resume"} required={actionMode === "reject"} value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder={actionMode === "reject" ? "Describe why the candidate is not progressing" : actionMode === "hold" ? "Explain what is blocking the shortlist" : "Explain why the candidate is back in the running"} />
      </Modal>
    </div>
  );
}
