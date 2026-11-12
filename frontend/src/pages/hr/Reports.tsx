import { useEffect, useMemo, useState } from "react";
import { hrApi, api } from "../../lib/api";
import { useApiQuery, queryKeys } from "../../hooks/useApiQuery";

const STATUS_OPTIONS = ["", "APPLIED", "UNDER_REVIEW", "AI_RECOMMENDED", "SHORTLISTED", "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED", "SELECTED", "REJECTED", "ON_HOLD", "OFFER_SENT", "OFFER_ACCEPTED", "DOCUMENTS_PENDING", "DOCUMENTS_UNDER_REVIEW", "HIRED", "WITHDRAWN"];

// Mirror of the backend REPORT_TYPES list — used only if the /reports/types call fails,
// so the dropdown always works and every option maps to a real database report.
const FALLBACK_REPORT_TYPES = [
  "employees", "former-employees", "department-employees", "employment-type",
  "applications", "pipeline", "shortlisting", "interviews", "selections", "rejections",
  "on-hold", "offers", "pending-documents", "ai-rankings", "skill-gap", "vacancies",
];

export default function Reports() {
  const [types, setTypes] = useState<string[]>([]);
  const [type, setType] = useState("");
  const [format, setFormat] = useState("json");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [jobOpeningId, setJobOpeningId] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [typesError, setTypesError] = useState("");

  const { data: overview } = useApiQuery<any>(queryKeys.dashboardOverview, () => hrApi.dashboardOverview());
  const { data: departments = [] } = useApiQuery<any[]>(["departments", "dropdown"], () => hrApi.departmentDropdown().then((r: any) => r?.data?.items ?? r?.data ?? []));
  const { data: openings = [] } = useApiQuery<any[]>(["openings", "dropdown-reports"], () => hrApi.openings({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? []));

  useEffect(() => {
    hrApi.reportsTypes()
      .then((r: any) => {
        const list = r?.data?.types ?? r?.types ?? [];
        if (!Array.isArray(list) || list.length === 0) {
          setTypes(FALLBACK_REPORT_TYPES);
          setTypesError("Could not load the report list from the server — showing the standard reports.");
        } else {
          setTypes(list);
        }
      })
      .catch(() => {
        setTypes(FALLBACK_REPORT_TYPES);
        setTypesError("Could not load the report list from the server — showing the standard reports.");
      });
  }, []);

  const filterParams = useMemo(() => ({
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(jobOpeningId ? { jobOpeningId } : {}),
    ...(status ? { status } : {}),
  }), [from, to, departmentId, jobOpeningId, status]);

  const run = async () => {
    setLoading(true); setError("");
    try {
      if (format === "json") {
        const r = await hrApi.report(type, filterParams);
        const data = r.data.rows ?? [];
        setRows(data);
        setHeaders(data.length ? Object.keys(data[0]) : []);
      } else {
        const r = await api.get(`/reports/${type}`, { params: { ...filterParams, format }, responseType: "blob" });
        const ct = String(r.headers["content-type"] ?? "application/octet-stream");
        const blob = new Blob([r.data as any], { type: ct });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `report_${type}_${new Date().toISOString().slice(0, 10)}.${format === "excel" ? "xlsx" : format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      const msg = err?.response?.data instanceof Blob
        ? "Report failed. The server returned an error — check that you have permission to view reports."
        : (err?.response?.data?.error?.message || "Report failed.");
      setError(msg);
    } finally { setLoading(false); }
  };

  const kpis = overview ? [
    ["Total Applications", overview.totalApplications],
    ["Pipeline Candidates", overview.pipelineCandidates],
    ["Shortlisted", overview.shortlistedCandidates],
    ["Interview Scheduled", overview.interviewsScheduled],
    ["Selected", overview.selectedCandidates],
    ["Hired", overview.hiredEmployees],
    ["Existing Employees", overview.existingEmployees],
    ["Former Employees", overview.formerEmployees],
  ] : [];

  return (
    <div className="min-h-screen surface-app p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold ink-body tracking-tight">Reports &amp; Analytics</h1>
        <p className="text-sm ink-soft mt-0.5">Live numbers from the cloud database, exportable to PDF, Excel and CSV.</p>
      </div>

      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {kpis.map(([label, value]) => (
            <div key={label as string} className="card p-4">
              <p className="text-[10px] sm:text-[11px] uppercase tracking-wider ink-soft font-bold">{label}</p>
              <p className="text-xl sm:text-2xl font-extrabold ink-body mt-1 tabular-nums">{value ?? 0}</p>
            </div>
          ))}
        </div>
      )}

      {typesError && <div className="mb-4 rounded-lg bg-[#F28C28]/10 border border-[#F28C28]/30 px-4 py-2.5 text-xs text-[#B15A10]">{typesError}</div>}
      {error && <div className="mb-4 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800">{error}</div>}

      <div className="card p-4 sm:p-5 mb-6 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <select className="select col-span-2 md:col-span-1" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Report type…</option>
          {types.map((t) => <option key={t} value={t}>{t.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</option>)}
        </select>
        <input type="date" className="input" title="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="input" title="To date" value={to} onChange={(e) => setTo(e.target.value)} />
        <select className="select" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          <option value="">All departments</option>
          {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="select" value={jobOpeningId} onChange={(e) => setJobOpeningId(e.target.value)}>
          <option value="">All openings</option>
          {openings.map((o: any) => <option key={o.id} value={o.id}>{o.title}</option>)}
        </select>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, " ") : "All statuses"}</option>)}
        </select>
        <select className="select" value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="json">Preview</option>
          <option value="csv">CSV</option>
          <option value="excel">Excel</option>
          <option value="pdf">PDF</option>
        </select>
        <button className="btn-primary col-span-2 md:col-span-1" onClick={run} disabled={loading || !type}>
          {loading ? "Generating…" : format === "json" ? "Preview" : "Download"}
        </button>
      </div>

      {format === "json" && rows.length >= 0 && headers.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="table min-w-[720px]">
            <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((row: any, i: number) => (
                <tr key={i}>{headers.map((h) => <td key={h} className="ink-soft">{row[h] instanceof Date ? new Date(row[h]).toLocaleDateString() : String(row[h] ?? "")}</td>)}</tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={headers.length} className="text-center py-8 ink-soft">No records match the filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {format === "json" && headers.length === 0 && !loading && (
        <div className="card p-10 text-center ink-soft">Select a report type and press Preview — results render here from the database.</div>
      )}
    </div>
  );
}
