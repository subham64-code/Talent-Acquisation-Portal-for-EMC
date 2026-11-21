import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  Briefcase,
  Download,
  FileText,
  Gauge,
  UsersRound,
  UserCheck,
  FileSearch,
  Sparkles,
  Building2,
  UserMinus,
  Laptop,
  BadgeCheck,
  ClipboardList,
  Trash2,
  FileWarning,
  RefreshCw,
} from "lucide-react";
import { hrApi, api } from "../../lib/api";
import { useApiQuery, queryKeys } from "../../hooks/useApiQuery";
import PageHeader from "../../components/ref/PageHeader";
import Badge from "../../components/ref/Badge";

const STATUS_OPTIONS = ["", "APPLIED", "UNDER_REVIEW", "AI_RECOMMENDED", "SHORTLISTED", "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED", "SELECTED", "REJECTED", "ON_HOLD", "OFFER_SENT", "OFFER_ACCEPTED", "DOCUMENTS_PENDING", "DOCUMENTS_UNDER_REVIEW", "HIRED", "WITHDRAWN"];

const FALLBACK_REPORT_TYPES = [
  "employees",
  "former-employees",
  "department-employees",
  "employment-type",
  "applications",
  "pipeline",
  "shortlisting",
  "interviews",
  "selections",
  "rejections",
  "on-hold",
  "offers",
  "pending-documents",
  "ai-rankings",
  "skill-gap",
  "vacancies",
];

const REPORT_META: Record<string, { title: string; description: string; category: string; icon: any }> = {
  employees: { title: "Employee master", description: "Every existing employee with department, qualification and status.", category: "People", icon: UsersRound },
  "former-employees": { title: "Former employees", description: "Separated employees and their previous designation and dates.", category: "People", icon: UserMinus },
  "department-employees": { title: "Department-wise headcount", description: "People count for every department.", category: "People", icon: Building2 },
  "employment-type": { title: "Employment type", description: "Full-time, part-time, contract and intern headcount distribution.", category: "People", icon: Laptop },
  applications: { title: "Applications", description: "Every application with position, status and applied date.", category: "Recruitment", icon: FileSearch },
  pipeline: { title: "Candidate pipeline", description: "All active candidates in the recruitment database.", category: "Recruitment", icon: Gauge },
  shortlisting: { title: "Shortlisting", description: "Candidates currently shortlisted for interviews.", category: "Recruitment", icon: UserCheck },
  interviews: { title: "Interviews", description: "Scheduled, completed and cancelled interview rounds.", category: "Recruitment", icon: ClipboardList },
  selections: { title: "Selections", description: "Candidates selected and awaiting approval or offer.", category: "Recruitment", icon: BadgeCheck },
  rejections: { title: "Rejections", description: "Rejected applicants and their target positions.", category: "Recruitment", icon: Trash2 },
  "on-hold": { title: "On hold", description: "Applications paused by HR and their positions.", category: "Recruitment", icon: FileWarning },
  offers: { title: "Offers", description: "Offer letters, salary, response and status.", category: "Offers & onboarding", icon: FileText },
  "pending-documents": { title: "Pending documents", description: "Document collection pending after accepted offers.", category: "Offers & onboarding", icon: FileText },
  "ai-rankings": { title: "AI rankings", description: "Skill, experience, qualification and overall AI scores.", category: "AI analytics", icon: Sparkles },
  "skill-gap": { title: "Skill gap", description: "Most-missed skills extracted from the AI screening matches.", category: "AI analytics", icon: Bot },
  vacancies: { title: "Vacancies", description: "Every opening, department, positions and deadline.", category: "People", icon: Briefcase },
};

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return String(value);
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString();
  }
  return text;
};

export default function Reports() {
  const navigate = useNavigate();
  const [types, setTypes] = useState<string[]>([]);
  const [type, setType] = useState("");
  const [format, setFormat] = useState<"json" | "csv" | "excel" | "pdf">("json");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [jobOpeningId, setJobOpeningId] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, pageSize: 100 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [typesError, setTypesError] = useState("");

  const { data: overview } = useApiQuery<any>(queryKeys.dashboardOverview, () => hrApi.dashboardOverview());
  const { data: departments = [] } = useApiQuery<any[]>(["departments", "dropdown"], () => hrApi.departmentDropdown().then((r: any) => r?.data?.items ?? r?.data ?? []));
  const { data: openings = [] } = useApiQuery<any[]>(["openings", "reports"], () => hrApi.openings({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? []));

  useEffect(() => {
    hrApi.reportsTypes()
      .then((response: any) => {
        const payload = response?.data?.data ?? response?.data;
        const list = Array.isArray(payload?.types) ? payload.types : [];
        setTypes(list.length ? list : FALLBACK_REPORT_TYPES);
        setTypesError(list.length ? "" : "Could not load the report list from the server — showing the standard reports.");
      })
      .catch(() => {
        setTypes(FALLBACK_REPORT_TYPES);
        setTypesError("Could not load the report list from the server — showing the standard reports.");
      });
  }, []);

  const filterParams = useMemo(() => ({
    page,
    pageSize: 100,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(jobOpeningId ? { jobOpeningId } : {}),
    ...(status ? { status } : {}),
  }), [page, from, to, departmentId, jobOpeningId, status]);

  // A changed filter always starts again from the first page.
  useEffect(() => { setPage(1); }, [from, to, departmentId, jobOpeningId, status, type]);

  const run = async (reportType = type, nextFormat: typeof format = format, explicitPage?: number) => {
    if (!reportType) return;
    setLoading(true);
    setError("");
    setFormat(nextFormat);
    try {
      setType(reportType);
      if (nextFormat === "json") {
        const response = await hrApi.report(reportType, { ...filterParams, page: explicitPage ?? page });
        const payload = response?.data?.data ?? response?.data;
        const data = Array.isArray(payload?.rows) ? payload.rows : [];
        setRows(data);
        setHeaders(data.length ? Object.keys(data[0]) : []);
        setPagination({
          total: Number(payload?.count ?? data.length),
          totalPages: Number(payload?.totalPages ?? 1),
          pageSize: Number(payload?.pageSize ?? 100),
        });
      } else {
        const response = await api.get(`/reports/${reportType}`, { params: { ...filterParams, format: nextFormat }, responseType: "blob" });
        const ct = String(response.headers["content-type"] ?? "application/octet-stream");
        const blob = new Blob([response.data as any], { type: ct });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${reportType}_${new Date().toISOString().slice(0, 10)}.${nextFormat === "excel" ? "xlsx" : nextFormat}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      const message = err?.response?.data instanceof Blob
        ? "Report failed. The server returned an error."
        : (err?.response?.data?.error?.message || "Report failed.");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const clearResult = () => {
    setRows([]);
    setHeaders([]);
  };

  const kpis = [
    { label: "Applications", value: Number(overview?.totalApplications ?? 0), meta: "Career portal received", icon: FileSearch, to: "/hr/submissions" },
    { label: "Pipeline candidates", value: Number(overview?.pipelineCandidates ?? 0), meta: "In active recruitment", icon: Gauge, to: "/hr/shortlisting" },
    { label: "Shortlisted", value: Number(overview?.shortlistedCandidates ?? 0), meta: "Interview ready", icon: UserCheck, to: "/hr/shortlisting" },
    { label: "Interviews scheduled", value: Number(overview?.interviewsScheduled ?? 0), meta: "Rounds awaiting feedback", icon: ClipboardList, to: "/hr/interviews" },
    { label: "Selected", value: Number(overview?.selectedCandidates ?? 0), meta: "Approved for offers", icon: BadgeCheck, to: "/hr/approvals" },
    { label: "Existing employees", value: Number(overview?.existingEmployees ?? 0), meta: "Current databank", icon: UsersRound, to: "/hr/employees?tab=current" },
    { label: "Former employees", value: Number(overview?.formerEmployees ?? 0), meta: "Historical databank", icon: UserMinus, to: "/hr/employees?tab=former" },
    { label: "Open vacancies", value: Math.max(0, Number(overview?.totalApplications ?? 0)), meta: "Report this number by department", icon: Briefcase, to: "/hr/manage-openings" },
  ];

  return (
    <div className="page reports-page">
      <PageHeader
        eyebrow="Ecometrix · Talent Acquisition"
        title="Reports & Analytics"
        subtitle="Live HR metrics, exportable recruitment reports and filterable database views."
        actions={<button type="button" className="btn btn--outline" onClick={() => run(type || types[0] || "applications", "excel")} disabled={loading}><Download size={16} aria-hidden="true" /> Export current view</button>}
      />

      {overview ? (
        <div className="reports-kpis" aria-label="HR key metrics">
          {kpis.map((card) => {
            const Icon = card.icon;
            return (
              <button type="button" className="report-kpi" key={card.label} onClick={() => navigate(card.to)} aria-label={`Open ${card.label}`}>
                <span className="report-kpi__icon"><Icon size={20} aria-hidden="true" /></span>
                <span className="report-kpi__content">
                  <span className="report-kpi__label">{card.label}</span>
                  <span className="report-kpi__value">{card.value}</span>
                  <span className="report-kpi__meta">{card.meta}</span>
                </span>
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="loading-block"><div className="spinner" /> Loading the analytics…</div>
      )}

      {typesError && <div className="notice notice--error" role="alert"><div className="notice__body">{typesError}</div></div>}
      {error && <div className="notice notice--error" role="alert"><div className="notice__body">{error}</div></div>}

      <section className="card reports-panel" aria-label="Report filters">
        <div className="card__header"><div><div className="card__title">Generate a report</div><div className="card__subtitle">Pick one report below, choose filters and press Preview. The result is rendered from the live database.</div></div></div>
        <div className="card__body reports-filter-grid">
          <select className="select" value={type} onChange={(event) => setType(event.target.value)} aria-label="Report type">
            <option value="">Choose a report…</option>
            {types.map((item) => <option key={item} value={item}>{REPORT_META[item]?.title ?? item.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")}</option>)}
          </select>
          <input type="date" className="input" title="From date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="From date" />
          <input type="date" className="input" title="To date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="To date" />
          <select className="select" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} aria-label="Department">
            <option value="">All departments</option>
            {departments.map((department: any) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
          <select className="select" value={jobOpeningId} onChange={(event) => setJobOpeningId(event.target.value)} aria-label="Job opening">
            <option value="">All openings</option>
            {openings.map((opening: any) => <option key={opening.id} value={opening.id}>{opening.title}</option>)}
          </select>
          <select className="select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status">
            {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item ? item.replace(/_/g, " ") : "All statuses"}</option>)}
          </select>
          <div className="reports-filter-actions">
            <button type="button" className="btn btn--primary" disabled={loading || !type} onClick={() => run(type)}>{loading ? "Generating…" : "Preview"}</button>
            <button type="button" className="btn btn--outline" disabled={loading || !type} onClick={() => run(type, "csv")}><Download size={16} aria-hidden="true" /> CSV</button>
            <button type="button" className="btn btn--outline" disabled={loading || !type} onClick={() => run(type, "excel")}><Download size={16} aria-hidden="true" /> Excel</button>
            <button type="button" className="btn btn--outline" disabled={loading || !type} onClick={() => run(type, "pdf")}><Download size={16} aria-hidden="true" /> PDF</button>
          </div>
        </div>
      </section>

      <section className="card reports-panel">
        <div className="card__header"><div><div className="card__title">Report library</div><div className="card__subtitle">Every report option HR can generate — click any card to preview it instantly.</div></div></div>
        <div className="card__body reports-library">
          {types.map((item) => {
            const meta = REPORT_META[item] ?? { title: item.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "), description: "Live database report.", category: "Other", icon: FileText };
            const Icon = meta.icon;
            const active = type === item;
            return (
              <button type="button" key={item} className={`report-library-card ${active ? "active" : ""}`} onClick={() => run(item, "json")} aria-pressed={active}>
                <span className="report-library-card__icon"><Icon size={22} aria-hidden="true" /></span>
                <span className="report-library-card__body">
                  <span className="report-library-card__title">{meta.title}</span>
                  <span className="report-library-card__description">{meta.description}</span>
                </span>
                <span className="report-library-card__category">{meta.category}</span>
              </button>
            );
          })}
        </div>
      </section>

      {(rows.length > 0 || headers.length > 0) && (
        <section className="card reports-result">
          <div className="card__header">
            <div><div className="card__title">{REPORT_META[type]?.title ?? "Report"}</div><div className="card__subtitle">{pagination.total} record{pagination.total === 1 ? "" : "s"} · page {page} of {pagination.totalPages}</div></div>
            <div className="reports-result-actions"><Badge variant="blue">Showing {rows.length} of {pagination.total}</Badge><button type="button" className="btn btn--ghost btn--sm" onClick={clearResult}><RefreshCw size={14} aria-hidden="true" /> Clear</button></div>
          </div>
          <div className="reports-result-wrap">
            <table className="data-table reports-table">
              <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
              <tbody>{rows.map((row, index) => <tr key={index}>{headers.map((header) => <td key={header}>{formatValue(row[header])}</td>)}</tr>)}</tbody>
            </table>
            {rows.length === 0 && <div className="empty-state">No records match these filters.</div>}
          </div>
          <div className="reports-pagination">
            <button type="button" className="btn btn--outline btn--sm" disabled={page <= 1 || loading} onClick={() => { setPage(page - 1); void run(type, "json", page - 1); }}>Previous</button>
            <span>Page {page} of {pagination.totalPages}</span>
            <button type="button" className="btn btn--outline btn--sm" disabled={page >= pagination.totalPages || loading} onClick={() => { setPage(page + 1); void run(type, "json", page + 1); }}>Next</button>
          </div>
        </section>
      )}
      {headers.length === 0 && !loading && <div className="card reports-empty"><Bot size={30} aria-hidden="true" /><h2>No report loaded yet</h2><p>Select a report card or a filter above and press <strong>Preview</strong>. Results will appear here.</p></div>}
    </div>
  );
}
