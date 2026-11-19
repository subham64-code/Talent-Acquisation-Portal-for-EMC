import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileSearch,
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
import { initials, formatDate, formatDateTime } from "./databank/shared";

const STATE_OPTIONS = [
  { value: "pending", label: "Awaiting AI Result" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "AI Completed" },
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
  const [detailLoading, setDetailLoading] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [remarkError, setRemarkError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [selectedOpening, setSelectedOpening] = useState("");
  const [running, setRunning] = useState(false);
  const [kpi, setKpi] = useState<string | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);

  const aiEvaluation = (item?: any | null) => (Number.isFinite(Number(item?.aiMatchScore)) ? "completed" : "pending");
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
      const statuses = ["UNDER_REVIEW", "AI_RECOMMENDED", "SHORTLISTED", "ON_HOLD", "REJECTED"];
      const lists = await Promise.all(statuses.map((status) => hrApi.applications({ page: 1, pageSize: 100, status }).then((r: any) => r?.data?.items ?? [])));
      const byId = new Map<string, any>();
      for (const item of lists.flat()) byId.set(item.id, item);
      setQueue(Array.from(byId.values()));
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

  const runAiScreening = async () => {
    if (!selectedOpening) {
      setError("Select a job opening before running AI screening.");
      return;
    }
    setRunning(true);
    setError("");
    setNotice("");
    try {
      const res = await hrApi.aiRun({ jobOpeningId: selectedOpening });
      const result = res?.data ?? res;
      const evaluated = result?.run?.candidatesEvaluated ?? result?.candidatesEvaluated ?? "";
      setNotice(evaluated ? `AI screening complete · ${evaluated} candidates evaluated.` : "AI screening complete.");
      setRunOpen(false);
      await load(true);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "AI screening failed.");
    } finally {
      setRunning(false);
    }
  };

  const openReview = async (entry: any) => {
    setReview(entry);
    setRemarks("");
    setRemarkError("");
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await hrApi.application(entry.id);
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
    awaitingAi: entries.filter((item) => aiEvaluation(item) === "pending").length,
    completedAi: entries.filter((item) => aiEvaluation(item) === "completed").length,
    awaitingDecision: entries.filter((item) => hrDecision(item) === "awaiting_decision").length,
    passed: entries.filter((item) => hrDecision(item) === "passed").length,
    onHold: entries.filter((item) => hrDecision(item) === "on_hold").length,
    rejected: entries.filter((item) => hrDecision(item) === "rejected").length,
    open: entries.filter((item) => ["UNDER_REVIEW", "AI_RECOMMENDED"].includes(item.status)).length,
    decided: entries.filter((item) => !["UNDER_REVIEW", "AI_RECOMMENDED"].includes(item.status)).length,
    all: entries.length,
  };

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
      const scored = group.filter((item) => Number.isFinite(Number(item.aiMatchScore))).sort((a, b) => Number(b.aiMatchScore) - Number(a.aiMatchScore));
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
      const scoreA = Number.isFinite(Number(a.aiMatchScore)) ? Number(a.aiMatchScore) : -1;
      const scoreB = Number.isFinite(Number(b.aiMatchScore)) ? Number(b.aiMatchScore) : -1;
      return scoreB - scoreA || String(a.applicationCode).localeCompare(String(b.applicationCode));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, statusFilter, positionFilter, aiEvaluationFilter, hrDecisionFilter, search]);

  const activeFilterCount = [search, positionFilter, aiEvaluationFilter, hrDecisionFilter, statusFilter !== "open" ? statusFilter : ""].filter(Boolean).length;
  const clearFilters = () => { setSearch(""); setPositionFilter(""); setAiEvaluationFilter(""); setHrDecisionFilter(""); setStatusFilter("open"); };

  const openFile = async (fileId?: string) => {
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

  const doDecision = async (kind: "pass" | "hold" | "reject" | "remarks") => {
    if (!review) return;
    const text = remarks.trim();
    if (["hold", "reject"].includes(kind) && !text) {
      setRemarkError(kind === "reject" ? "Record the rejection reason before rejecting the candidate." : "Record the hold reason before placing the application on hold.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (kind === "pass") {
        await hrApi.applicationStatus(review.id, { status: "SHORTLISTED", remarks: text || "Passed the CV screening." });
        setNotice("Candidate passed the screening and is awaiting shortlisting.");
      } else if (kind === "hold") {
        await hrApi.applicationStatus(review.id, { status: "ON_HOLD", remarks: text });
        setNotice("Application placed on hold.");
      } else if (kind === "reject") {
        await hrApi.applicationStatus(review.id, { status: "REJECTED", remarks: text });
        setNotice("Application rejected at screening.");
      } else {
        await hrApi.applicationRemarks(review.id, { body: text });
        setNotice("Screening remarks recorded.");
      }
      setReview(null);
      setDetail(null);
      setRemarks("");
      setRemarkError("");
      await load(true);
      if (kind === "pass") navigate("/hr/shortlisting");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not save the screening decision.");
    } finally {
      setBusy(false);
    }
  };

  const app = detail ?? review;
  const candidate = app?.candidate;
  const job = app?.jobOpening ?? app?.jobOpeningId;
  const match = (detail?.matches && detail.matches[0]) || null;
  const aiMeta = aiEvaluation(app) === "completed" ? { label: "AI Evaluation Completed", variant: "green" as const } : { label: "Awaiting AI Result", variant: "grey" as const };
  const aiResultMeta = match ? { label: "AI Screening Service", variant: "purple" as const } : null;
  const scoreValue = Number.isFinite(Number(app?.aiMatchScore)) ? Math.round(Number(app.aiMatchScore)) : null;
  const position = Array.isArray(positions) ? positions.find((item: any) => item.id === (app?.jobOpeningId || app?.jobOpening?.id)) : null;
  const requiredSkills: string[] = Array.isArray(position?.requiredSkills) ? position.requiredSkills : [];
  const candidateSkills = (candidate?.skills ?? []).map((record: any) => record.skill?.name || record.name || "").filter(Boolean);
  const docs = [
    app?.resumeFile ? { id: app.resumeFile.id, category: { name: "Resume", isRequired: true }, status: "ACCEPTED" } : null,
    ...(app?.documents ?? []),
  ].filter(Boolean) as any[];

  const KPI_MATCHERS: Record<string, (item: any) => boolean> = {
    total: () => true,
    "awaiting-ai": (item) => aiEvaluation(item) === "pending",
    "ai-completed": (item) => aiEvaluation(item) === "completed",
    "awaiting-decision": (item) => hrDecision(item) === "awaiting_decision",
    passed: (item) => hrDecision(item) === "passed",
    "on-hold": (item) => hrDecision(item) === "on_hold",
    rejected: (item) => hrDecision(item) === "rejected",
  };
  const KPI_DETAILS: Record<string, { title: string; description: string }> = {
    total: { title: "Total in Screening", description: "Applications HR has moved into the CV screening queue." },
    "awaiting-ai": { title: "Awaiting AI Evaluation", description: "Candidates without an AI screening score yet." },
    "ai-completed": { title: "AI Evaluation Completed", description: "Candidates whose AI scores are ready for HR review." },
    "awaiting-decision": { title: "Awaiting HR Decision", description: "Candidates waiting for an HR decision after review." },
    passed: { title: "Passed", description: "Candidates moved forward to the shortlisting decision." },
    "on-hold": { title: "On Hold", description: "Applications currently placed on hold." },
    rejected: { title: "Rejected", description: "Applications rejected during screening." },
  };
  const openKpi = async (key: string) => {
    setKpi(key);
    setKpiLoading(true);
    try {
      await load(true);
    } finally {
      setKpiLoading(false);
    }
  };
  const kpiEntries = useMemo(() => (kpi ? entries.filter(KPI_MATCHERS[kpi] ?? (() => false)) : []), [entries, kpi]);

  const statsCards = [
    { key: "total", label: "Total in Screening", value: counts.total, meta: "Explicitly transferred by HR", icon: Inbox, variant: "blue" },
    { key: "awaiting-ai", label: "Awaiting AI Evaluation", value: counts.awaitingAi, meta: "No AI result received yet", icon: Bot, variant: "orange" },
    { key: "ai-completed", label: "AI Evaluation Completed", value: counts.completedAi, meta: "Awaiting HR decision", icon: ShieldCheck, variant: "purple" },
    { key: "awaiting-decision", label: "Awaiting HR Decision", value: counts.awaitingDecision, meta: "AI ranks shown, decision pending", icon: UsersRound, variant: "orange" },
    { key: "passed", label: "Passed", value: counts.passed, meta: "Moved to shortlisting decision", icon: CheckCircle2, variant: "green" },
    { key: "on-hold", label: "On Hold", value: counts.onHold, meta: "Application paused", icon: UserCheck, variant: "grey" },
    { key: "rejected", label: "Rejected", value: counts.rejected, meta: "Application closed", icon: Trash2, variant: "red" },
  ];

  const columns: Column<any>[] = [
    { key: "rank", header: "Rank", className: "text-right", render: (row) => <span className="cell-strong">{Number.isFinite(ranks.get(row.id)) ? `#${ranks.get(row.id)}` : "—"}</span> },
    { key: "candidate", header: "Candidate", render: (row) => <div className="cell-user"><div className="avatar">{initials(row.candidate?.fullName || "")}</div><div className="cell-user__text"><button type="button" className="ta-link cell-user__name" onClick={() => void openReview(row)} aria-label={`Open screening workspace for ${row.candidate?.fullName}`}>{row.candidate?.fullName}</button><div className="cell-user__sub">{row.candidate?.candidateCode || "—"}</div></div></div> },
    { key: "application", header: "Application ID", render: (row) => <span className="cell-strong">{row.applicationCode}</span> },
    { key: "position", header: "Position", render: (row) => <div><div>{row.jobOpening?.title || "—"}</div><div className="cell-muted">{row.jobOpening?.department?.name || "—"}</div></div> },
    { key: "experience", header: "Experience", render: (row) => row.candidate?.totalExperience != null ? `${row.candidate.totalExperience} yrs` : "—" },
    { key: "score", header: "Match Score", className: "text-right", render: (row) => Number.isFinite(Number(row.aiMatchScore)) ? <span className="cell-strong">{Math.round(Number(row.aiMatchScore))}%</span> : <span className="cell-muted">Awaiting AI Result</span> },
    { key: "ai", header: "AI Evaluation", render: (row) => <Badge variant={aiEvaluation(row) === "completed" ? "green" : "grey"} dot>{aiEvaluation(row) === "completed" ? "AI Completed" : "Awaiting AI Result"}</Badge> },
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
    { key: "position", header: "Position", render: (row) => <div className="cell-stack"><strong>{row.jobOpening?.title || "—"}</strong><span className="cell-muted">{row.jobOpening?.department?.name || "—"}</span></div> },
    { key: "experience", header: "Experience", render: (row) => <span className="cell-nowrap">{row.candidate?.totalExperience != null ? `${row.candidate.totalExperience} yrs` : "—"}</span> },
    { key: "score", header: "AI Score", className: "text-right", render: (row) => Number.isFinite(Number(row.aiMatchScore)) ? <span className="cell-strong">{Math.round(Number(row.aiMatchScore))}%</span> : <span className="cell-muted">Pending</span> },
    { key: "ai", header: "AI Evaluation", render: (row) => <Badge variant={aiEvaluation(row) === "completed" ? "green" : "grey"} dot>{aiEvaluation(row) === "completed" ? "AI Completed" : "Awaiting AI"}</Badge> },
    { key: "decision", header: "HR Decision", render: (row) => { const decision = hrDecision(row); const meta = decision === "passed" ? { label: "Passed", variant: "green" as const } : decision === "on_hold" ? { label: "On Hold", variant: "grey" as const } : decision === "rejected" ? { label: "Rejected", variant: "red" as const } : { label: "Awaiting", variant: "orange" as const }; return <Badge variant={meta.variant} dot>{meta.label}</Badge>; } },
    { key: "status", header: "Status", render: (row) => <CandidateStatusBadge status={row.status} /> },
    { key: "actions", header: "Action", className: "text-right", render: (row) => <button type="button" className="btn btn--outline btn--sm" onClick={() => openKpiApplication(row)}><Eye size={14} aria-hidden="true" /> Details</button> },
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Ecometrix · Talent Acquisition"
        title="CV Screening"
        subtitle="Review candidate CVs, evaluate job requirement matching, and record HR screening decisions."
        actions={(<><Button variant="secondary" icon={Bot} onClick={() => setRunOpen((current) => !current)}>Run AI Screening</Button><Button variant="outline" icon={RefreshCw} onClick={() => void load(true)}>Refresh data</Button></>)}
      />

      {runOpen && (
        <section className="card" style={{ marginBottom: "1rem" }}>
          <div className="card__header">
            <div><div className="card__title">Run AI Screening</div><div className="card__subtitle">Rank every application for a vacancy against the required skills, experience and qualifications</div></div>
          </div>
          <div className="card__body">
            <div className="grid grid-cols-1 md:grid-cols-[2fr_auto] gap-3 items-end">
              <div className="field" style={{ margin: 0 }}>
                <Select label="Job opening" required value={selectedOpening} onChange={(event: any) => setSelectedOpening(event.target.value)} placeholder="Select a vacancy to screen…" options={positions.map((item: any) => ({ value: item.id, label: `${item.title} · ${item.department?.name || ""}` }))} />
              </div>
              <Button icon={Sparkles} onClick={runAiScreening} loading={running}>Run screening</Button>
            </div>
          </div>
        </section>
      )}

      {notice && <div className="notice notice--success" role="status"><div className="notice__body">{notice}</div></div>}
      {error && <div className="notice notice--error" role="alert"><div className="notice__body">{error}</div></div>}

      <div className="stats-grid ta-stats-grid ta-screening-stats" aria-label="Screening statistics">
        {statsCards.map((card) => { const Icon = card.icon; const isActive = kpi === card.key; return <button type="button" className={`stat-card ${isActive ? "stat-card--active" : "stat-card--muted"}`} key={card.key} onClick={() => void openKpi(card.key)} aria-pressed={isActive} aria-label={`Open ${card.label} details`}><div className={`stat-card__icon ${isActive ? "stat-card__icon--active" : "stat-card__icon--muted"}`}><Icon size={20} aria-hidden="true" /></div><div className="stat-card__content"><div className="stat-card__label">{card.label}</div><div className="stat-card__value">{card.value}</div><div className="stat-card__meta">{card.meta}</div></div></button>; })}
      </div>

      <section className="ta-applications-toolbar" aria-label="Screening filters">
        <div className="ta-applications-toolbar__row">
          <div className="search-box ta-applications-toolbar__search"><span className="search-box__icon"><Search size={16} aria-hidden="true" /></span><input type="search" className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search candidate name, application ID or position" aria-label="Search the screening queue" /></div>
          <Select aria-label="Filter by position" value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)} placeholder="All positions" options={positions.map((item: any) => ({ value: item.id, label: item.title }))} />
          <Select aria-label="Filter by screening status" value={["UNDER_REVIEW", "AI_RECOMMENDED", "SHORTLISTED", "ON_HOLD", "REJECTED"].includes(statusFilter) ? statusFilter : ""} onChange={(event) => setStatusFilter((event.target.value as any) || "all")} placeholder="All screening statuses" options={[{ value: "UNDER_REVIEW", label: "Under Review" }, { value: "AI_RECOMMENDED", label: "AI Recommended" }, { value: "SHORTLISTED", label: "Passed" }, { value: "ON_HOLD", label: "On Hold" }, { value: "REJECTED", label: "Rejected" }]} />
          <Select aria-label="Filter by AI evaluation status" value={aiEvaluationFilter} onChange={(event) => setAiEvaluationFilter(event.target.value)} options={[{ value: "", label: "All AI evaluation states" }, ...STATE_OPTIONS]} />
          <Select aria-label="Filter by HR decision" value={hrDecisionFilter} onChange={(event) => setHrDecisionFilter(event.target.value)} options={DECISION_OPTIONS} />
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
            if (kpi === "awaiting-ai" || kpi === "ai-completed") setAiEvaluationFilter(kpi === "awaiting-ai" ? "pending" : "completed");
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
            loading={kpiLoading}
            empty={<EmptyState icon={Inbox} title="No candidates in this KPI" description="Matching candidates will appear here as the screening queue changes." />}
            footer={<><span><strong>{kpiEntries.length}</strong> matching candidate{kpiEntries.length === 1 ? "" : "s"}</span><span className="cell-muted">Click any candidate to open the full screening workspace</span></>}
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(review)}
        onClose={() => (busy ? undefined : setReview(null))}
        title={review ? `Screening workspace · ${review.candidate?.fullName}` : "Screening workspace"}
        subtitle={review ? `${job?.title || "Position"} · ${review.applicationCode}` : undefined}
        size="xl"
        footer={review ? (
          <>
            <Link to={`/hr/submissions/${review.id}`} className="btn btn--ghost btn--sm"><ClipboardCheck size={14} aria-hidden="true" /> Open candidate profile</Link>
            <Button variant="outline" onClick={() => setReview(null)} disabled={busy}>Close</Button>
            {!["SHORTLISTED", "REJECTED", "SELECTED"].includes(review.status) && <Button variant="outline" icon={PauseCircle} onClick={() => void doDecision("hold")} disabled={busy}>On Hold</Button>}
            {!["REJECTED", "SELECTED"].includes(review.status) && <Button variant="danger-ghost" icon={XCircle} onClick={() => void doDecision("reject")} disabled={busy}>Reject</Button>}
            {["UNDER_REVIEW", "AI_RECOMMENDED"].includes(review.status) && <Button variant="secondary" icon={CheckCircle2} onClick={() => void doDecision("pass")} loading={busy}>Passed</Button>}
            <Button onClick={() => void doDecision("remarks")} loading={busy} disabled={!remarks.trim()}>Save Remarks</Button>
          </>
        ) : undefined}
      >
        {review && (
          <div className="ta-screening-layout">
            <div className="ta-screening-layout__main">
              <section className="ta-panel">
                <div className="ta-panel__header">Candidate overview</div>
                <div className="detail-grid detail-grid--3">
                  <div className="detail-item"><div className="detail-item__label">Candidate</div><div className="detail-item__value">{candidate?.fullName}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Candidate ID</div><div className="detail-item__value">{candidate?.candidateCode || "—"}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Application ID</div><div className="detail-item__value">{review.applicationCode}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Position</div><div className="detail-item__value">{job?.title || "—"}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Department</div><div className="detail-item__value">{job?.department?.name || "—"}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Experience</div><div className="detail-item__value">{candidate?.totalExperience ?? "—"} yrs</div></div>
                  <div className="detail-item"><div className="detail-item__label">Location</div><div className="detail-item__value">{candidate?.currentLocation || "—"}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Applied on</div><div className="detail-item__value">{formatDate(review.appliedAt)}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Application status</div><div className="detail-item__value"><CandidateStatusBadge status={review.status} /></div></div>
                  <div className="detail-item"><div className="detail-item__label">AI evaluation</div><div className="detail-item__value"><Badge variant={aiMeta.variant} dot>{aiMeta.label}</Badge></div></div>
                </div>
              </section>

              <section className="ta-panel">
                <div className="ta-panel__header">Job requirements</div>
                <div className="detail-grid detail-grid--3">
                  <div className="detail-item"><div className="detail-item__label">Title</div><div className="detail-item__value">{job?.title || "—"}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Department</div><div className="detail-item__value">{job?.department?.name || "—"}</div></div>
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
                <div className="detail-grid detail-grid--3">
                  <div className="detail-item"><div className="detail-item__label">Required experience</div><div className="detail-item__value">{job?.minExperience ?? "0"} yrs</div></div>
                  <div className="detail-item"><div className="detail-item__label">Candidate experience</div><div className="detail-item__value">{candidate?.totalExperience ?? "—"} yrs</div></div>
                  <div className="detail-item"><div className="detail-item__label">Experience match</div><div className="detail-item__value">{Number(candidate?.totalExperience ?? 0) >= Number(job?.minExperience ?? 0) ? <Badge variant="green">Meets requirement</Badge> : <Badge variant="red">Below requirement</Badge>}</div></div>
                  <div className="detail-item" style={{ gridColumn: "1 / -1" }}><div className="detail-item__label">Educational qualifications</div>{candidate?.education?.length ? <ul className="ta-detail-list">{candidate.education.map((item: any) => <li className="ta-detail-list__item" key={item.id}><div className="ta-detail-list__title">{item.degree}</div><div className="ta-detail-list__meta">{item.institution}{item.field ? ` · ${item.field}` : ""}{item.endYear ? ` · ${item.endYear}` : ""}</div></li>)}</ul> : <p className="detail-item__value detail-item__value--muted">No education details were provided.</p>}</div>
                  <div className="detail-item" style={{ gridColumn: "1 / -1" }}><div className="detail-item__label">Education match</div><div className="detail-item__value">{candidate?.qualification || "Not provided"}</div></div>
                </div>
              </section>

              <section className="ta-panel">
                <div className="ta-panel__header"><Bot size={15} aria-hidden="true" /> AI evaluation summary</div>
                <div className="ta-screening-ai">
                  {aiResultMeta && <Badge variant={aiResultMeta.variant}><Sparkles size={12} aria-hidden="true" />{aiResultMeta.label}</Badge>}
                  <div className="detail-grid detail-grid--3" style={{ marginTop: "0.75rem" }}>
                    <div className="detail-item"><div className="detail-item__label">Overall matching score</div><div className="detail-item__value">{scoreValue !== null ? `${scoreValue}%` : "Awaiting AI Result"}</div></div>
                    <div className="detail-item"><div className="detail-item__label">Skills match</div><div className="detail-item__value">{match ? `${Math.round(Number(match.skillScore ?? 0))}%` : "—"}</div></div>
                    <div className="detail-item"><div className="detail-item__label">Experience match</div><div className="detail-item__value">{match ? `${Math.round(Number(match.experienceScore ?? 0))}%` : "—"}</div></div>
                  </div>
                  {match ? <><p className="ta-screening-ai__summary">{match.explanation || "Score generated by the AI screening service from the candidate CV and job requirements."}</p>{Array.isArray(match.missingSkills) && match.missingSkills.length > 0 && <p className="ta-screening-ai__missing">Not covered: {match.missingSkills.join(", ")}</p>}</> : <p className="ta-screening-ai__meta">No AI result has been received for this application. The screening score stays at <strong>Awaiting AI Result</strong> until the backend screening service returns a result.</p>}
                  {match && <p className="ta-screening-ai__meta">Matched skills: {Array.isArray(match.matchedSkills) ? match.matchedSkills.join(", ") : "—"}</p>}
                </div>
              </section>

              <section className="ta-panel"><div className="ta-panel__header">Documents</div>{docs.length === 0 ? <p className="detail-item__value detail-item__value--muted">No documents received yet.</p> : <ul className="ta-detail-list">{docs.map((doc: any) => <li className="ta-detail-list__item" key={doc.id}><div className="ta-detail-list__title">{doc.category?.name || "Document"}</div><div className="ta-detail-list__meta">{doc.status}{doc.fileId && <button type="button" className="ta-link" onClick={() => void openFile(doc.fileId)}>Preview</button>}</div></li>)}</ul>}</section>

              <section className="ta-panel"><div className="ta-panel__header">HR screening remarks</div><Textarea value={remarks} onChange={(event) => { setRemarks(event.target.value); if (remarkError) setRemarkError(""); }} placeholder="Summarise the screening outcome and the reason for the decision" error={remarkError} /><p className="ta-screening-ai__meta" style={{ marginTop: "0.35rem" }}>Remarks are stored with the application. Required for On Hold and Rejected decisions.</p></section>
            </div>

            <aside className="ta-screening-layout__side">
              <div className="ta-score-card"><div className="ta-score-card__label">Match score</div><div className="ta-score-card__value">{scoreValue !== null ? `${scoreValue}%` : "—"}</div><div className="ta-score-card__meta">{scoreValue !== null ? "Score returned by the screening service" : "Awaiting AI Result"}</div></div>
              <div className="ta-panel"><div className="ta-panel__header">Application status</div><div className="detail-grid"><div className="detail-item"><div className="detail-item__label">Stage</div><div className="detail-item__value">{review.status.replace(/_/g, " ")}</div></div><div className="detail-item"><div className="detail-item__label">Source</div><div className="detail-item__value">{review.source || "Career Portal"}</div></div><div className="detail-item"><div className="detail-item__label">Applied on</div><div className="detail-item__value">{formatDate(review.appliedAt)}</div></div><div className="detail-item"><div className="detail-item__label">Screening status</div><div className="detail-item__value">{hrDecision(review).replace(/_/g, " ")}</div></div></div></div>
            </aside>
          </div>
        )}
      </Modal>

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
