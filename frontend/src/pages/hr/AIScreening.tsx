import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Inbox,
  ListFilter,
  PauseCircle,
  RefreshCw,
  Search,
  Sparkles,
  ShieldCheck,
  Trash2,
  UserCheck,
  UsersRound,
  XCircle,
} from "lucide-react";
import { hrApi } from "../../lib/api";
import PageHeader from "../../components/ref/PageHeader";
import Button from "../../components/ref/Button";
import Badge from "../../components/ref/Badge";
import Modal from "../../components/ref/Modal";
import CandidateStatusBadge from "../../components/ref/CandidateStatusBadge";
import EmptyState from "../../components/ref/EmptyState";
import DataTable, { type Column } from "../../components/DataTable";
import { Select, Textarea } from "../../components/ref/Input";
import { initials, formatDate } from "./databank/shared";

const STATE_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Evaluated" },
  { value: "failed", label: "Failed" },
];

const DECISION_OPTIONS = [
  { value: "", label: "All HR decisions" },
  { value: "awaiting_decision", label: "Awaiting Review" },
  { value: "passed", label: "Passed" },
  { value: "on_hold", label: "On Hold" },
  { value: "rejected", label: "Rejected" },
];

type Decision = "awaiting_decision" | "passed" | "on_hold" | "rejected";

export default function AIScreening() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const autoOpenedRef = useRef<string | null>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"open" | "decided" | "all">("open");
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [aiEvaluationFilter, setAiEvaluationFilter] = useState("");
  const [hrDecisionFilter, setHrDecisionFilter] = useState("");
  const [review, setReview] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [, setDetailLoading] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [remarkError, setRemarkError] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [screeningPosition, setScreeningPosition] = useState("");
  const [selectedOpening, setSelectedOpening] = useState("");
  const [running, setRunning] = useState(false);
  const [jobProgress, setJobProgress] = useState<{ total: number; processed: number; status: string } | null>(null);
  const [kpi, setKpi] = useState<string | null>(null);

  const hasScore = (item?: any | null) => item?.aiMatchScore !== null && item?.aiMatchScore !== undefined && Number.isFinite(Number(item.aiMatchScore));
  // Persisted status is authoritative. `aiMatchScore` remains as a fallback for
  // rows screened before the status column existed.
  const aiEvaluation = (item?: any | null): "pending" | "processing" | "completed" | "failed" => {
    const state = String(item?.screeningStatus ?? "").toLowerCase();
    if (state === "processing") return "processing";
    if (state === "failed") return "failed";
    if (state === "evaluated" || hasScore(item)) return "completed";
    return "pending";
  };
  const aiBadge = (item?: any | null) => {
    switch (aiEvaluation(item)) {
      case "completed": return { label: "Evaluated", variant: "green" as const };
      case "processing": return { label: "Processing", variant: "orange" as const };
      case "failed": return { label: "Failed", variant: "red" as const };
      default: return { label: "Pending", variant: "grey" as const };
    }
  };
  const hrDecision = (item?: any | null): Decision => {
    switch (item?.status) {
      case "SHORTLISTED":
      case "SELECTED":
        return "passed";
      case "ON_HOLD":
        return "on_hold";
      case "REJECTED":
        return "rejected";
      default:
        return "awaiting_decision";
    }
  };

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const statuses = ["APPLIED", "UNDER_REVIEW", "AI_RECOMMENDED", "SHORTLISTED", "ON_HOLD", "REJECTED"];
      const res = await hrApi.applications({ page: 1, pageSize: 100, status: statuses.join(",") });
      setQueue(res?.data?.items ?? []);
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not load the screening queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    hrApi.openings({ page: 1, pageSize: 100 }).then((r: any) => setPositions(r?.data?.items ?? [])).catch(() => setPositions([]));
  }, []);

  const runAiScreening = async (jobOpeningIdArg?: string) => {
    const jobOpeningIdToRun = jobOpeningIdArg || selectedOpening;
    if (!jobOpeningIdToRun) {
      setError("Select a job opening before running AI screening.");
      return;
    }
    setSelectedOpening(jobOpeningIdToRun);
    setPositionFilter(jobOpeningIdToRun);
    setScreeningPosition(jobOpeningIdToRun);
    setRunning(true);
    setError("");
    setNotice("");
    setJobProgress({ total: 0, processed: 0, status: "PENDING" });
    try {
      const res = await hrApi.aiRun({ jobOpeningId: jobOpeningIdToRun });
      const jobId = res?.data?.jobId ?? (res as any)?.jobId;
      if (!jobId) throw new Error("The screening job could not be started.");

      let job: any = null;
      for (let attempt = 0; attempt < 600; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const poll = await hrApi.aiJob(jobId);
        job = poll?.data?.job ?? (poll as any)?.job ?? poll?.data ?? poll;
        setJobProgress({
          total: Number(job?.total ?? 0),
          processed: Number(job?.processed ?? 0),
          status: String(job?.status ?? "PENDING"),
        });
        if (attempt % 5 === 0) await load(true);
        if (["COMPLETED", "FAILED"].includes(job?.status)) break;
      }
      if (!job) throw new Error("Could not read the screening job status.");
      if (job.status === "FAILED") {
        setError(job.error || "AI screening failed.");
      } else {
        const parts = [`${job.succeeded ?? 0} evaluated`];
        if (job.skipped) parts.push(`${job.skipped} already evaluated`);
        if (job.failed) parts.push(`${job.failed} failed`);
        setNotice(`AI screening complete for selected position - ${parts.join(", ")}.`);
      }
      await load(true);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err?.message || "AI screening failed.");
    } finally {
      setRunning(false);
      setJobProgress(null);
    }
  };

  const openReview = async (entry: any) => {
      setReview(entry);
      setRemarks("");
      setRemarkError("");
      setDetail(null);
      setDetailLoading(true);
      try {
        const res = await hrApi.application(entry.id, { compact: 1 });
        setDetail(res?.data?.item ?? res?.data ?? null);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || "Could not load the full candidate record.");
      } finally {
        setDetailLoading(false);
      }
  };

  useEffect(() => {
    const requested = searchParams.get("application");
    if (!requested || autoOpenedRef.current === requested || loading || queue.length === 0) return;
    const item = queue.find((entry) => entry.id === requested);
    if (!item) return;
    autoOpenedRef.current = requested;
    void openReview(item);
    const next = new URLSearchParams(searchParams);
    next.delete("application");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, loading, searchParams]);

  const entries = queue;
  const counts = {
    total: entries.length,
    awaitingAi: 0,
    processingAi: 0,
    completedAi: 0,
    failedAi: 0,
    awaitingDecision: 0,
    passed: 0,
    onHold: 0,
    rejected: 0,
    open: 0,
    decided: 0,
    all: entries.length,
  };
  for (const item of entries) {
    const evaluation = aiEvaluation(item);
    if (evaluation === "pending") counts.awaitingAi += 1;
    else if (evaluation === "processing") counts.processingAi += 1;
    else if (evaluation === "failed") counts.failedAi += 1;
    else counts.completedAi += 1;
    const decision = hrDecision(item);
    if (decision === "awaiting_decision") counts.awaitingDecision += 1;
    else if (decision === "passed") counts.passed += 1;
    else if (decision === "on_hold") counts.onHold += 1;
    else if (decision === "rejected") counts.rejected += 1;
    if (["UNDER_REVIEW", "AI_RECOMMENDED"].includes(item.status)) counts.open += 1;
    else counts.decided += 1;
  }

  const ranks = useMemo(() => {
    const map = new Map<string, number>();
    const groups = new Map<string, any[]>();
    for (const item of entries) {
      const key = item.jobOpeningId || item.jobOpening?.id || "unassigned";
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }
    for (const group of groups.values()) {
      const scored = group.filter((item) => hasScore(item)).sort((a, b) => Number(b.aiMatchScore) - Number(a.aiMatchScore));
      scored.forEach((item, index) => map.set(item.id, index + 1));
    }
    return map;
  }, [entries]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...entries].filter((item) => {
      const isOpen = ["UNDER_REVIEW", "AI_RECOMMENDED"].includes(item.status);
      if (statusFilter === "open" && !isOpen) return false;
      if (statusFilter === "decided" && isOpen) return false;
      if (positionFilter && (item.jobOpeningId || item.jobOpening?.id) !== positionFilter) return false;
      if (aiEvaluationFilter && aiEvaluation(item) !== aiEvaluationFilter) return false;
      if (hrDecisionFilter && hrDecision(item) !== hrDecisionFilter) return false;
      if (!term) return true;
      return [item.applicationCode, item.candidate?.fullName, item.candidate?.email, item.jobOpening?.title, item.aiMatchScore]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    }).sort((a, b) => {
      const scoreA = hasScore(a) ? Number(a.aiMatchScore) : -1;
      const scoreB = hasScore(b) ? Number(b.aiMatchScore) : -1;
      return scoreB - scoreA || String(a.applicationCode).localeCompare(String(b.applicationCode));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, statusFilter, positionFilter, aiEvaluationFilter, hrDecisionFilter, search]);

  const activeFilterCount = [search, positionFilter, aiEvaluationFilter, hrDecisionFilter, statusFilter !== "open" ? statusFilter : ""].filter(Boolean).length;
  const clearFilters = () => { setSearch(""); setPositionFilter(""); setAiEvaluationFilter(""); setHrDecisionFilter(""); setStatusFilter("open"); };

  const doDecision = async (kind: "pass" | "hold" | "reject" | "remarks") => {
    if (!review) return;
    const currentIndex = visible.findIndex((item) => item.id === review.id);
    const nextCandidate = currentIndex >= 0 ? visible[currentIndex + 1] : undefined;
    const text = remarks.trim();
    if (["hold", "reject"].includes(kind) && !text) {
      setRemarkError(kind === "reject" ? "Record the rejection reason before rejecting the candidate." : "Record the hold reason before placing the application on hold.");
      return;
    }
    setBusyAction(kind);
    setError("");
    try {
      const decisionMap: Record<string, string> = { pass: "SHORTLISTED", hold: "ON_HOLD", reject: "REJECTED", remarks: "REMARKS" };
      await hrApi.recordScreeningDecision(review.id, {
        decision: decisionMap[kind],
        remarks: text || (kind === "pass" ? "Passed the CV screening." : undefined),
      });
      setNotice(kind === "pass" ? "Candidate passed the screening and is awaiting shortlisting." : kind === "hold" ? "Application placed on hold." : kind === "reject" ? "Application rejected at screening." : "Screening remarks recorded.");
      setRemarks("");
      setRemarkError("");
      await load(true);
      setReview(null);
      setDetail(null);
      if (kind === "pass") navigate("/hr/shortlisting");
      if (kind === "hold") navigate("/hr/employees?tab=hold");
      if (kind === "reject") navigate("/hr/submissions?status=REJECTED");

    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not save the screening decision.");
    } finally {
      setBusyAction(null);
    }
  };

  const app = detail ?? review;
  const candidate = app?.candidate;
  const job = app?.jobOpening ?? app?.jobOpeningId;
  const match = (detail?.matches && detail.matches[0]) || null;
  const aiMeta = aiBadge(app);

  const scoreValue = hasScore(app) ? Math.round(Number(app.aiMatchScore)) : null;
  const position = Array.isArray(positions) ? positions.find((item: any) => item.id === (app?.jobOpeningId || app?.jobOpening?.id)) : null;
  const requiredSkills: string[] = Array.isArray(position?.requiredSkills) ? position.requiredSkills : [];
  const candidateSkills = (candidate?.skills ?? []).map((record: any) => record.skill?.name || record.name || "").filter(Boolean);

  const KPI_MATCHERS: Record<string, (item: any) => boolean> = {
    total: () => true,
    "awaiting-ai": (item) => aiEvaluation(item) === "pending",
    processing: (item) => aiEvaluation(item) === "processing",
    "ai-completed": (item) => aiEvaluation(item) === "completed",
    failed: (item) => aiEvaluation(item) === "failed",
    "awaiting-decision": (item) => hrDecision(item) === "awaiting_decision",
    passed: (item) => hrDecision(item) === "passed",
    "on-hold": (item) => hrDecision(item) === "on_hold",
    rejected: (item) => hrDecision(item) === "rejected",
  };
  const KPI_DETAILS: Record<string, { title: string; description: string }> = {
    total: { title: "Total in Screening", description: "Applications HR has moved into the CV screening queue." },
    "awaiting-ai": { title: "Pending Evaluation", description: "Candidates without an AI screening result yet." },
    processing: { title: "Processing", description: "Candidates currently being evaluated by AI screening." },
    "ai-completed": { title: "Evaluated", description: "Candidates whose real AI scores are ready for HR review." },
    failed: { title: "Failed", description: "Candidates whose CV could not be evaluated and need manual review." },
    "awaiting-decision": { title: "Awaiting HR Decision", description: "Candidates waiting for an HR decision after review." },
    passed: { title: "Passed", description: "Candidates moved forward to the shortlisting decision." },
    "on-hold": { title: "On Hold", description: "Applications currently placed on hold." },
    rejected: { title: "Rejected", description: "Applications rejected during screening." },
  };
  // KPI drill-down is derived from the data already loaded; it never retriggers
  // the expensive full workspace fetch.
  const openKpi = (key: string) => setKpi(key);
  const kpiEntries = useMemo(() => (kpi ? entries.filter(KPI_MATCHERS[kpi] ?? (() => false)) : []), [entries, kpi]);

  const statsCards = [
    { key: "total", label: "Total in Screening", value: counts.total, meta: "Explicitly transferred by HR", icon: Inbox, variant: "blue" },
    { key: "awaiting-ai", label: "Pending", value: counts.awaitingAi, meta: "Not evaluated yet", icon: Bot, variant: "orange" },
    { key: "ai-completed", label: "Evaluated", value: counts.completedAi, meta: "Real AI score available", icon: ShieldCheck, variant: "purple" },
    { key: "failed", label: "Failed", value: counts.failedAi, meta: "Needs manual review", icon: XCircle, variant: "red" },
    { key: "awaiting-decision", label: "Awaiting HR Decision", value: counts.awaitingDecision, meta: "Decision pending", icon: UsersRound, variant: "orange" },
    { key: "passed", label: "Passed", value: counts.passed, meta: "Moved to shortlisting", icon: CheckCircle2, variant: "green" },
    { key: "on-hold", label: "On Hold", value: counts.onHold, meta: "Application paused", icon: UserCheck, variant: "grey" },
    { key: "rejected", label: "Rejected", value: counts.rejected, meta: "Application closed", icon: Trash2, variant: "red" },
  ];

  const columns: Column<any>[] = [
    { key: "rank", header: "Rank", className: "text-right", render: (row) => <span className="cell-strong">{ranks.get(row.id) ? `#${ranks.get(row.id)}` : "—"}</span> },
    { key: "candidate", header: "Candidate", render: (row) => <div className="cell-user"><div className="avatar">{initials(row.candidate?.fullName || "")}</div><div className="cell-user__text"><button type="button" className="ta-link cell-user__name" onClick={() => void openReview(row)} aria-label={`Open screening workspace for ${row.candidate?.fullName}`}>{row.candidate?.fullName}</button><div className="cell-user__sub">{row.candidate?.candidateCode || "—"}</div></div></div> },
    { key: "application", header: "Application ID", render: (row) => <span className="cell-strong">{row.applicationCode}</span> },
    { key: "position", header: "Position", render: (row) => <span>{row.jobOpening?.title || "—"}</span> },
    { key: "experience", header: "Experience", render: (row) => row.candidate?.totalExperience != null ? `${row.candidate.totalExperience} yrs` : "—" },
    { key: "score", header: "Match Score", className: "text-right", render: (row) => hasScore(row) ? <span className="cell-strong">{Math.round(Number(row.aiMatchScore))}%</span> : <span className="cell-muted">—</span> },
    { key: "ai", header: "AI Evaluation", render: (row) => { const state = aiBadge(row); return <Badge variant={state.variant} dot>{state.label}</Badge>; } },
    { key: "decision", header: "HR Decision", render: (row) => { const decision = hrDecision(row); const meta = decision === "passed" ? { label: "Passed", variant: "green" as const } : decision === "on_hold" ? { label: "On Hold", variant: "grey" as const } : decision === "rejected" ? { label: "Rejected", variant: "red" as const } : { label: "Awaiting Review", variant: "orange" as const }; return <Badge variant={meta.variant} dot>{meta.label}</Badge>; } },
    { key: "application", header: "Application", render: (row) => <CandidateStatusBadge status={row.status} /> },
    { key: "actions", header: "Actions", className: "text-right", render: (row) => <div className="cell-actions"><button type="button" className="btn btn--ghost btn--icon" onClick={() => void openReview(row)} aria-label={`Open screening workspace for ${row.candidate?.fullName}`} title="Open screening workspace"><Eye size={16} /></button></div> },
  ];

  const openKpiApplication = (row: any) => {
    setKpi(null);
    void openReview(row);
  };
  const kpiColumns: Column<any>[] = [
    { key: "candidate", header: "Candidate", className: "kpi-candidate", render: (row) => <div className="cell-user"><div className="avatar">{initials(row.candidate?.fullName || "")}</div><div className="cell-user__text"><button type="button" className="ta-link cell-user__name" onClick={() => openKpiApplication(row)}>{row.candidate?.fullName}</button><div className="cell-user__sub">{row.candidate?.candidateCode || "—"}</div></div></div> },
    { key: "applicationCode", header: "Application ID", render: (row) => <span className="cell-strong">{row.applicationCode}</span> },
    { key: "position", header: "Position", render: (row) => <strong>{row.jobOpening?.title || "—"}</strong> },
    { key: "experience", header: "Experience", render: (row) => <span className="cell-nowrap">{row.candidate?.totalExperience != null ? `${row.candidate.totalExperience} yrs` : "—"}</span> },
    { key: "score", header: "AI Score", className: "text-right", render: (row) => hasScore(row) ? <span className="cell-strong">{Math.round(Number(row.aiMatchScore))}%</span> : <span className="cell-muted">—</span> },
    { key: "ai", header: "AI Evaluation", render: (row) => { const state = aiBadge(row); return <Badge variant={state.variant} dot>{state.label}</Badge>; } },
    { key: "decision", header: "HR Decision", render: (row) => { const decision = hrDecision(row); const meta = decision === "passed" ? { label: "Passed", variant: "green" as const } : decision === "on_hold" ? { label: "On Hold", variant: "grey" as const } : decision === "rejected" ? { label: "Rejected", variant: "red" as const } : { label: "Awaiting", variant: "orange" as const }; return <Badge variant={meta.variant} dot>{meta.label}</Badge>; } },
    { key: "status", header: "Status", render: (row) => <CandidateStatusBadge status={row.status} /> },
    { key: "actions", header: "Action", className: "text-right", render: (row) => <button type="button" className="btn btn--outline btn--sm" onClick={() => openKpiApplication(row)}><Eye size={14} aria-hidden="true" /> Details</button> },
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Ecometrix Talent Acquisition"
        title="AI Screening"
        subtitle="Select a job position and run AI screening. Recommendations appear in the table automatically."
        actions={undefined}
      />

      {notice && <div className="notice notice--success" role="status"><div className="notice__body">{notice}</div></div>}
      {error && <div className="notice notice--error" role="alert"><div className="notice__body">{error}</div></div>}

      <div className="stats-grid ta-stats-grid ta-screening-stats" aria-label="Screening statistics">
        {statsCards.map((card) => { const Icon = card.icon; const isActive = kpi === card.key; return <button type="button" className={`stat-card ${isActive ? "stat-card--active" : "stat-card--muted"}`} key={card.key} onClick={() => void openKpi(card.key)} aria-pressed={isActive} aria-label={`Open ${card.label} details`}><div className={`stat-card__icon ${isActive ? "stat-card__icon--active" : "stat-card__icon--muted"}`}><Icon size={20} aria-hidden="true" /></div><div className="stat-card__content"><div className="stat-card__label">{card.label}</div><div className="stat-card__value">{card.value}</div><div className="stat-card__meta">{card.meta}</div></div></button>; })}
      </div>

      <section className="ta-applications-toolbar" aria-label="Screening filters" style={{ overflow: "visible", position: "relative", zIndex: 20 }}>
        <div className="ta-applications-toolbar__row">
          <div className="search-box ta-applications-toolbar__search"><span className="search-box__icon"><Search size={16} aria-hidden="true" /></span><input type="search" className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search candidate name, application ID or position" aria-label="Search the screening queue" /></div>
          <Select aria-label="Filter by position" value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)} placeholder="All positions" options={positions.map((item: any) => ({ value: item.id, label: item.title }))} />
          <Select aria-label="Filter by screening status" value={["UNDER_REVIEW", "AI_RECOMMENDED", "SHORTLISTED", "ON_HOLD", "REJECTED"].includes(statusFilter) ? statusFilter : ""} onChange={(event) => setStatusFilter((event.target.value as any) || "all")} placeholder="All screening statuses" options={[{ value: "UNDER_REVIEW", label: "Under Review" }, { value: "AI_RECOMMENDED", label: "AI Recommended" }, { value: "SHORTLISTED", label: "Passed" }, { value: "ON_HOLD", label: "On Hold" }, { value: "REJECTED", label: "Rejected" }]} />
          <Select aria-label="Filter by AI evaluation status" value={aiEvaluationFilter} onChange={(event) => setAiEvaluationFilter(event.target.value)} options={[{ value: "", label: "All AI evaluation states" }, ...STATE_OPTIONS]} />
          <Select aria-label="Filter by HR decision" value={hrDecisionFilter} onChange={(event) => setHrDecisionFilter(event.target.value)} options={DECISION_OPTIONS} />
          <Button variant="secondary" size="sm" icon={Sparkles} onClick={() => void runAiScreening(positionFilter)} loading={running} disabled={!positionFilter}>AI Screening</Button>
        </div>
        <div className="ta-applications-toolbar__meta">
          <div className="filters">
            <button type="button" className={`ta-filter-chip ${statusFilter === "open" ? "active" : ""}`} onClick={() => setStatusFilter("open")}>Open <span className="ta-filter-chip__count">{counts.open}</span></button>
            <button type="button" className={`ta-filter-chip ${statusFilter === "decided" ? "active" : ""}`} onClick={() => setStatusFilter("decided")}>Decided <span className="ta-filter-chip__count">{counts.decided}</span></button>
            <button type="button" className={`ta-filter-chip ${statusFilter === "all" ? "active" : ""}`} onClick={() => setStatusFilter("all")}>All <span className="ta-filter-chip__count">{counts.all}</span></button>
          </div>
          <div className="ta-applications-toolbar__spacer" />
          <span className="filters-summary"><ListFilter size={13} aria-hidden="true" /> {visible.length} matching candidate{visible.length === 1 ? "" : "s"}</span>
          {activeFilterCount > 0 && <Button variant="ghost" size="sm" icon={Trash2} onClick={clearFilters}>Clear filters ({activeFilterCount})</Button>}
        </div>
      </section>

      <DataTable
        columns={columns}
        rows={visible}
        rowKey={(row) => row.id}
        loading={loading}
        empty={<EmptyState icon={ClipboardCheck} title="No candidate in the screening queue" description="Applications appear here when HR clicks Move to Screening on a candidate profile." />}
        footer={<><span>Showing <strong>{visible.length}</strong> candidate{visible.length === 1 ? "" : "s"}</span><span className="cell-muted">Position-wise ranking · score descending</span></>}
      />

      <Modal
        open={Boolean(kpi)}
        onClose={() => setKpi(null)}
        title={kpi ? KPI_DETAILS[kpi]?.title : "KPI details"}
        subtitle={kpi ? `${KPI_DETAILS[kpi]?.description ?? "Matching applications"} · ${kpiEntries.length} candidate${kpiEntries.length === 1 ? "" : "s"}` : undefined}
        size="xl"
        footer={(() => {
          const applyKpiFilter = () => {
            setAiEvaluationFilter("");
            setHrDecisionFilter("");
            setStatusFilter("all");
            if (["awaiting-ai", "ai-completed", "processing", "failed"].includes(kpi ?? "")) {
              setAiEvaluationFilter(kpi === "awaiting-ai" ? "pending" : kpi === "ai-completed" ? "completed" : (kpi ?? ""));
            }
            if (kpi === "awaiting-decision" || kpi === "passed" || kpi === "on-hold" || kpi === "rejected") setHrDecisionFilter(kpi === "on-hold" ? "on_hold" : kpi === "awaiting-decision" ? "awaiting_decision" : kpi);
            setKpi(null);
          };
          return <><Button variant="outline" onClick={() => setKpi(null)}>Close</Button><Button icon={ClipboardCheck} onClick={applyKpiFilter}>View in screening table</Button></>;
        })()}
      >
        <div className="kpi-detail-table">
          <DataTable
            columns={kpiColumns}
            rows={kpiEntries}
            rowKey={(row) => row.id}
            loading={false}
            empty={<EmptyState icon={Inbox} title="No candidates in this KPI" description="Matching candidates will appear here as the screening queue changes." />}
            footer={<><span><strong>{kpiEntries.length}</strong> matching candidate{kpiEntries.length === 1 ? "" : "s"}</span><span className="cell-muted">Click any candidate to open the full screening workspace</span></>}
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(review)}
        onClose={() => (busyAction ? undefined : setReview(null))}
        title={review ? `Screening workspace · ${review.candidate?.fullName}` : "Screening workspace"}
        subtitle={review ? `${job?.title || "Position"} · ${review.applicationCode}` : undefined}
        size="xl"
        footer={review ? (
          <>
            <Link to={`/hr/submissions/${review.id}`} className="btn btn--ghost btn--sm"><ClipboardCheck size={14} aria-hidden="true" /> Open candidate profile</Link>
            <Button variant="outline" onClick={() => setReview(null)} disabled={Boolean(busyAction)}>Close</Button>
            {!["SHORTLISTED", "REJECTED", "SELECTED"].includes(review.status) && <Button variant="outline" icon={PauseCircle} onClick={() => void doDecision("hold")} disabled={Boolean(busyAction)} loading={busyAction === "hold"}>On Hold</Button>}
            {!["REJECTED", "SELECTED"].includes(review.status) && <Button variant="danger-ghost" icon={XCircle} onClick={() => void doDecision("reject")} disabled={Boolean(busyAction)} loading={busyAction === "reject"}>Reject</Button>}
            {["UNDER_REVIEW", "AI_RECOMMENDED"].includes(review.status) && <Button variant="secondary" icon={CheckCircle2} onClick={() => void doDecision("pass")} loading={busyAction === "pass"} disabled={Boolean(busyAction)}>Passed</Button>}
            <Button onClick={() => void doDecision("remarks")} loading={busyAction === "remarks"} disabled={!remarks.trim() || Boolean(busyAction)}>Save Remarks</Button>
          </>
        ) : undefined}
      >
        {review && (
          <div className="ta-screening-layout">
            <div className="ta-screening-layout__main">
              <section className="ta-panel ta-panel--wide">
                <div className="ta-panel__header">Candidate overview</div>
                <div className="detail-grid detail-grid--3">
                  <div className="detail-item"><div className="detail-item__label">Candidate</div><div className="detail-item__value">{candidate?.fullName}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Candidate ID</div><div className="detail-item__value">{candidate?.candidateCode || "—"}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Application ID</div><div className="detail-item__value">{review.applicationCode}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Position</div><div className="detail-item__value">{job?.title || "—"}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Experience</div><div className="detail-item__value">{candidate?.totalExperience ?? "—"} yrs</div></div>
                  <div className="detail-item"><div className="detail-item__label">Applied on</div><div className="detail-item__value">{formatDate(review.appliedAt)}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Application status</div><div className="detail-item__value"><CandidateStatusBadge status={review.status} /></div></div>
                  <div className="detail-item"><div className="detail-item__label">AI evaluation</div><div className="detail-item__value"><Badge variant={aiMeta.variant} dot>{aiMeta.label}</Badge></div></div>
                </div>
              </section>

              <section className="ta-panel ta-panel--wide">
                <div className="ta-panel__header">Job requirements</div>
                <div className="detail-grid detail-grid--3">
                  <div className="detail-item"><div className="detail-item__label">Title</div><div className="detail-item__value">{job?.title || "—"}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Required experience</div><div className="detail-item__value">{job?.minExperience ?? Math.floor(Number(job?.requiredYears || 0))} yrs</div></div>
                  <div className="detail-item detail-item--full"><div className="detail-item__label">Required skills</div><div className="ta-chip-list">{requiredSkills.map((skill) => <span className="ta-chip" key={skill}>{skill}</span>)}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Required qualification</div><div className="detail-item__value">{job?.requiredQualification || "—"}</div></div>
                  {job?.description && <div className="detail-item" style={{ gridColumn: "1 / -1" }}><div className="detail-item__label">Job description</div><div className="detail-item__value">{job.description}</div></div>}
                </div>
              </section>

              <section className="ta-panel">
                <div className="ta-panel__header">Candidate skills comparison</div>
                <table className="ta-compare-table"><thead><tr><th scope="col">Required skill</th><th scope="col">Candidate skill</th><th scope="col">Match</th></tr></thead><tbody>{requiredSkills.map((skill) => { const normalized = skill.toLowerCase(); const owned = candidateSkills.find((item: string) => item.toLowerCase() === normalized); const related = owned ?? candidateSkills.find((item: string) => item.toLowerCase().includes(normalized)); const matched = Boolean(owned); return <tr key={skill}><td>{skill}</td><td>{owned || related || "Not found"}</td><td>{matched ? <Badge variant="green">Matched</Badge> : related ? <Badge variant="orange">Related</Badge> : <Badge variant="red">Missing</Badge>}</td></tr>; })}{requiredSkills.length === 0 && <tr><td colSpan={3} className="cell-muted">No required skills configured on this opening.</td></tr>}</tbody></table>
              </section>

              <section className="ta-panel">
                <div className="ta-panel__header">Experience and education</div>
                <div className="detail-grid">
                  <div className="detail-item"><div className="detail-item__label">Required experience</div><div className="detail-item__value">{job?.minExperience ?? "0"} yrs</div></div>
                  <div className="detail-item"><div className="detail-item__label">Candidate experience</div><div className="detail-item__value">{candidate?.totalExperience ?? "—"} yrs</div></div>
                  <div className="detail-item"><div className="detail-item__label">Experience match</div><div className="detail-item__value">{Number(candidate?.totalExperience ?? 0) >= Number(job?.minExperience ?? 0) ? <Badge variant="green">Meets requirement</Badge> : <Badge variant="red">Below requirement</Badge>}</div></div>
                  <div className="detail-item" style={{ gridColumn: "1 / -1" }}><div className="detail-item__label">Educational qualifications</div>{candidate?.education?.length ? <ul className="ta-detail-list">{candidate.education.map((item: any) => <li className="ta-detail-list__item" key={item.id}><div className="ta-detail-list__title">{item.degree}</div><div className="ta-detail-list__meta">{item.institution}{item.field ? ` · ${item.field}` : ""}{item.endYear ? ` · ${item.endYear}` : ""}</div></li>)}</ul> : <p className="detail-item__value detail-item__value--muted">No education details were provided.</p>}</div>
                  <div className="detail-item" style={{ gridColumn: "1 / -1" }}><div className="detail-item__label">Education match</div><div className="detail-item__value">{candidate?.qualification || "Not provided"}</div></div>
                </div>
              </section>

              <section className="ta-panel ta-panel--wide">
                <div className="ta-panel__header"><Bot size={15} aria-hidden="true" /> AI evaluation — data analysis</div>
                <div className="ta-screening-ai">
                  {match ? (() => {
                    const isV2 = match.scoringVersion === "v2";
                    const v2Dimensions: any[] = Array.isArray(match.dimensionScores)
                      ? match.dimensionScores
                      : Array.isArray(match.evidenceRecords)
                        ? match.evidenceRecords.map((row: any) => ({ dimension: row.dimension, score: row.score, applicability: row.applicability, weight: row.weight, evidence: row.evidence, reason: row.reason }))
                        : [];
                    const v2Labels: Record<string, string> = {
                      skills: "Skills match", experience: "Experience match", qualification: "Qualification match",
                      project: "Project relevance", role: "Role relevance", certification: "Certification match",
                    };
                    const bars: Array<{ label: string; value: number | null }> = isV2 && v2Dimensions.length > 0
                      ? [
                          { label: "Overall match", value: Math.round(Number(match.overallScore ?? scoreValue ?? 0)) },
                          ...v2Dimensions.map((item) => ({ label: v2Labels[item.dimension] ?? item.dimension, value: item.score == null ? null : Math.round(Number(item.score)) })),
                        ]
                      : [
                          { label: "Overall match", value: Math.round(Number(match.overallScore ?? scoreValue ?? 0)) },
                          { label: "Skills match", value: Math.round(Number(match.skillScore ?? 0)) },
                          { label: "Experience match", value: Math.round(Number(match.experienceScore ?? 0)) },
                          { label: "Qualification match", value: Math.round(Number(match.qualificationScore ?? 0)) },
                          { label: "Domain match", value: Math.round(Number(match.domainScore ?? 0)) },
                          { label: "Certification match", value: Math.round(Number(match.certificationScore ?? 0)) },
                        ];
                    const overall = bars[0].value ?? 0;
                    const reco = isV2
                      ? (() => {
                          switch (match.recommendation) {
                            case "STRONG_MATCH": return { label: "Strong match — suitable for interview", variant: "green" as const };
                            case "GOOD_MATCH": return { label: "Good match — HR review recommended", variant: "green" as const };
                            case "PARTIAL_MATCH": return { label: "Partial match — manual review", variant: "orange" as const };
                            case "INSUFFICIENT_INFORMATION": return { label: "Insufficient information — manual review", variant: "grey" as const };
                            default: return { label: "Manual review required", variant: "orange" as const };
                          }
                        })()
                      : overall >= 75 ? { label: "Strong match — recommended for interview", variant: "green" as const } : overall >= 55 ? { label: "Potential match — review before shortlisting", variant: "orange" as const } : { label: "Low match — manual review", variant: "red" as const };
                    const tone = (value: number) => (value >= 75 ? "is-good" : value >= 55 ? "is-mid" : "is-low");
                    const matchedList = Array.isArray(match.matchedSkills) ? match.matchedSkills : [];
                    const missingList = Array.isArray(match.missingSkills) ? match.missingSkills : [];
                    const strengthsList = Array.isArray(match.strengths) ? match.strengths : [];
                    const gapsList = Array.isArray(match.gaps) ? match.gaps : [];
                    return (
                      <>
                        <div className="ta-analysis" role="group" aria-label="Match percentage breakdown">
                          {bars.map((bar) => (
                            <div className="ta-analysis__row" key={bar.label}>
                              <span className="ta-analysis__label">{bar.label}</span>
                              <div className="ta-analysis__track" aria-hidden="true"><span className={`ta-analysis__bar ${tone(bar.value ?? 0)}`} style={{ width: `${bar.value == null ? 0 : Math.min(100, Math.max(0, bar.value))}%` }} /></div>
                              <span className={`ta-analysis__value ${tone(bar.value ?? 0)}`}>{bar.value == null ? "Unknown" : `${bar.value}%`}</span>
                            </div>
                          ))}
                        </div>
                        <div className="ta-analysis__verdict"><Badge variant={reco.variant} dot><Sparkles size={12} aria-hidden="true" />{reco.label}</Badge></div>
                        {isV2 && (
                          <div className="ta-analysis__evidence">
                            <p className="ta-screening-ai__meta"><strong>Data completeness:</strong> {Math.round(Number(match.dataCompleteness ?? 0) * 100)}% · <strong>Extraction confidence:</strong> {Math.round(Number(match.extractionConfidence ?? 0) * 100)}%</p>
                            {Array.isArray(match.missingEvidence) && match.missingEvidence.length > 0 && (
                              <p className="ta-screening-ai__missing"><strong>Missing evidence:</strong> {match.missingEvidence.join(", ")}</p>
                            )}
                            {v2Dimensions.map((item) => (
                              <div className="ta-analysis__evidence-row" key={item.dimension}>
                                <div className="ta-analysis__evidence-head"><strong>{v2Labels[item.dimension] ?? item.dimension}</strong><span>{item.applicability === "SCORED" ? `${item.score}%` : String(item.applicability ?? "").replace("_", " ").toLowerCase()}</span></div>
                                <p className="ta-screening-ai__meta">{item.reason}</p>
                                {Array.isArray(item.evidence) && item.evidence.length > 0 && <ul>{item.evidence.map((text: string, index: number) => <li key={index}>{text}</li>)}</ul>}
                              </div>
                            ))}
                          </div>
                        )}
                        {(matchedList.length > 0 || missingList.length > 0) && (
                          <div className="ta-analysis__skills">
                            {matchedList.length > 0 && <p className="ta-screening-ai__meta"><strong className="text-green-700">Matched ({matchedList.length}):</strong> {matchedList.join(", ")}</p>}
                            {missingList.length > 0 && <p className="ta-screening-ai__missing"><strong>Not covered ({missingList.length}):</strong> {missingList.join(", ")}</p>}
                          </div>
                        )}
                        {strengthsList.length > 0 && <ul className="ta-analysis__list" aria-label="Strengths">{strengthsList.map((item: string) => <li key={item} className="ta-analysis__item is-good">✓ {item}</li>)}</ul>}
                        {gapsList.length > 0 && <ul className="ta-analysis__list" aria-label="Gaps">{gapsList.map((item: string) => <li key={item} className="ta-analysis__item is-low">✕ {item}</li>)}</ul>}
                        <p className="ta-screening-ai__summary">{match.explanation || "Score generated by the AI screening service from the candidate CV and job requirements."}</p>
                      </>
                    );
                  })() : (
                    <p className="ta-screening-ai__meta">No AI result has been received for this application yet. Run AI Screening for this opening — the score, percentage breakdown and recommendation will appear here automatically.</p>
                  )}
                </div>
              </section>

              <section className="ta-panel ta-panel--wide"><div className="ta-panel__header">HR screening remarks</div><Textarea value={remarks} onChange={(event) => { setRemarks(event.target.value); if (remarkError) setRemarkError(""); }} placeholder="Summarise the screening outcome and the reason for the decision" error={remarkError} /><p className="ta-screening-ai__meta" style={{ marginTop: "0.35rem" }}>Remarks are stored with the application. Required for On Hold and Rejected decisions.</p></section>
            </div>

              <aside className="ta-screening-layout__side">
              <div className="ta-score-card"><div className="ta-score-card__label">Match score</div><div className="ta-score-card__value">{scoreValue !== null ? `${scoreValue}%` : "—"}</div><div className="ta-score-card__meta">{scoreValue !== null ? "Score returned by the screening service" : "Not evaluated yet"}</div></div>
              <div className="ta-panel"><div className="ta-panel__header">Application status</div><div className="detail-grid"><div className="detail-item"><div className="detail-item__label">Stage</div><div className="detail-item__value">{review.status.replace(/_/g, " ")}</div></div><div className="detail-item"><div className="detail-item__label">Source</div><div className="detail-item__value">{review.source || "Career Portal"}</div></div><div className="detail-item"><div className="detail-item__label">Applied on</div><div className="detail-item__value">{formatDate(review.appliedAt)}</div></div><div className="detail-item"><div className="detail-item__label">Screening status</div><div className="detail-item__value">{hrDecision(review).replace(/_/g, " ")}</div></div></div></div>
            </aside>
          </div>
        )}
      </Modal>
    </div>
  );
}
