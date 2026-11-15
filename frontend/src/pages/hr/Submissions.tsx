import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { hrApi } from "../../lib/api";
import { useDebounced } from "../../hooks/useDebounced";
import { useApiQuery, queryKeys, useInvalidate } from "../../hooks/useApiQuery";
import DataTable, { type Column } from "../../components/DataTable";

const STATUS_TONE: Record<string, string> = {
  SHORTLISTED: "border-[#659616]/30 bg-[#659616]/10 text-[#659616]/80",
  SELECTED: "border-[#659616]/30 bg-[#659616]/10 text-[#659616]/80",
  HIRED: "border-[#659616]/30 bg-[#659616]/10 text-[#659616]/80",
  INTERVIEW_SCHEDULED: "border-[#8BC34A]/40 bg-[#8BC34A]/10 text-[#5E8C31]",
  ON_HOLD: "border-[#FF9412]/30 bg-[#FF9412]/10 text-[#FF9412]/80",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
  APPLIED: "border-[#171717]/15 bg-[#171717]/5 ink-soft",
  UNDER_REVIEW: "border-[#171717]/15 bg-[#171717]/5 ink-soft",
};

const LABELS: Record<string, string> = {
  APPLIED: "Applied", UNDER_REVIEW: "Under Review", AI_RECOMMENDED: "AI Recommended", SHORTLISTED: "Shortlisted",
  INTERVIEW_SCHEDULED: "Interview Scheduled", INTERVIEW_COMPLETED: "Interview Completed", SELECTED: "Selected",
  REJECTED: "Rejected", ON_HOLD: "On Hold", OFFER_SENT: "Offer Sent", OFFER_ACCEPTED: "Offer Accepted",
  DOCUMENTS_PENDING: "Documents Pending", DOCUMENTS_UNDER_REVIEW: "Documents Under Review", HIRED: "Hired", WITHDRAWN: "Withdrawn",
};

function Badge({ status }: { status: string }) {
  return (
    <span className={`badge whitespace-nowrap ${STATUS_TONE[status] || "border-[#171717]/15 bg-[#171717]/5 ink-soft"}`}>
      {LABELS[status] || status}
    </span>
  );
}

export default function Submissions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [jobOpeningId, setJobOpeningId] = useState(() => searchParams.get("jobOpeningId") || "");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const debouncedSearch = useDebounced(search);
  const invalidate = useInvalidate();

  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedSearch) next.set("search", debouncedSearch);
    if (jobOpeningId) next.set("jobOpeningId", jobOpeningId);
    setSearchParams(next, { replace: true });
  }, [debouncedSearch, jobOpeningId, setSearchParams]);

  const params = useMemo(
    () => ({ page: 1, pageSize: 100, search: debouncedSearch || undefined, jobOpeningId: jobOpeningId || undefined, status: status || undefined }),
    [debouncedSearch, jobOpeningId, status],
  );

  const { data: items = [], isLoading } = useApiQuery<any[]>(
    queryKeys.applications(params),
    () => hrApi.applications(params).then((r: any) => r?.data?.items ?? []),
  );
  const { data: openings = [] } = useApiQuery<any[]>(
    queryKeys.openings({ dropdown: true }),
    () => hrApi.openings({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? []),
  );

  const changeStatus = async (id: string, next: string, remarks?: string) => {
    setMessage("");
    try {
      await hrApi.applicationStatus(id, { status: next, remarks });
      setMessage(`Application marked as ${next.replace(/_/g, " ").toLowerCase()}.`);
      invalidate(["applications", "dashboard"]);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Status change failed.");
    }
  };

  const viewCV = async (fileId: string) => {
    try {
      const r = await hrApi.fileAccessToken(fileId);
      window.open(r.data.url, "_blank");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Cannot open the CV.");
    }
  };

  const columns: Column<any>[] = useMemo(() => [
    { key: "idx", header: "#", render: (_r, i) => <span className="ink-soft">{i + 1}</span> },
    { key: "name", header: "Candidate", render: (a) => <span className="font-medium ink-body">{a.candidate?.fullName}</span> },
    { key: "code", header: "Application ID", hideOnMobile: true, render: (a) => <span className="font-mono text-xs ink-soft">{a.applicationCode}</span> },
    { key: "email", header: "Email", hideOnMobile: true, render: (a) => <span className="ink-soft">{a.candidate?.email}</span> },
    { key: "mobile", header: "Mobile", hideOnMobile: true, render: (a) => <span className="ink-soft">{a.candidate?.mobile || "—"}</span> },
    { key: "date", header: "Date", hideOnMobile: true, render: (a) => <span className="ink-soft text-xs">{new Date(a.appliedAt).toLocaleDateString()}</span> },
    { key: "position", header: "Position", render: (a) => <span className="ink-soft">{a.jobOpening?.title}</span> },
    { key: "qual", header: "Qual.", hideOnMobile: true, render: (a) => <span className="ink-soft">{a.candidate?.qualification || "—"}</span> },
    { key: "exp", header: "Exp", hideOnMobile: true, render: (a) => <span className="ink-soft">{a.candidate?.totalExperience ?? "—"} yrs</span> },
    {
      key: "score", header: "AI Score", hideOnMobile: true,
      render: (a) => a.aiMatchScore != null
        ? <span className="font-semibold text-[#659616]">{Math.round(a.aiMatchScore)}</span>
        : <span className="ink-soft">—</span>,
    },
    { key: "status", header: "Status", render: (a) => <Badge status={a.status} /> },
    {
      key: "actions", header: "Actions",
      render: (a) => (
        <div className="flex gap-1 flex-wrap">
          <button className="btn-xs btn-outline whitespace-nowrap" onClick={() => changeStatus(a.id, "SHORTLISTED")} disabled={a.status === "SHORTLISTED"}>Shortlist</button>
          <button className="btn-xs btn-outline whitespace-nowrap" onClick={() => { if (window.confirm("Mark this candidate as SELECTED? They will become eligible for an offer letter.")) changeStatus(a.id, "SELECTED"); }} disabled={!["SHORTLISTED", "INTERVIEW_COMPLETED", "INTERVIEW_SCHEDULED"].includes(a.status) || a.status === "SELECTED"}>Select</button>
          <button className="btn-xs btn-outline whitespace-nowrap" onClick={() => { const r = window.prompt("Rejection reason (optional):") ?? undefined; changeStatus(a.id, "REJECTED", r); }} disabled={a.status === "REJECTED"}>Reject</button>
          <button className="btn-xs btn-outline whitespace-nowrap" onClick={() => { const r = window.prompt("Hold reason:") ?? ""; changeStatus(a.id, "ON_HOLD", r); }} disabled={a.status === "ON_HOLD"}>Hold</button>
          {a.resumeFileId && <button className="btn-xs btn-ghost whitespace-nowrap" onClick={() => viewCV(a.resumeFileId)}>CV</button>}
        </div>
      ),
    },
  ], []);

  return (
    <div className="min-h-screen surface-app p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-extrabold ink-body tracking-tight">View Submissions</h1>
          <p className="text-sm ink-soft mt-0.5">Every application received across EMC vacancies.</p>
        </div>
        <span className="badge border-[#171717]/15 surface-card ink-soft">{items.length} shown</span>
      </div>

      {message && (
        <div className="mb-4 rounded-lg bg-[#659616]/10 border border-[#659616]/25 px-4 py-2.5 text-sm text-[#659616] flex items-start justify-between gap-3">
          <span>{message}</span>
          <button onClick={() => setMessage("")} className="font-bold">×</button>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError("")} className="font-bold">×</button>
        </div>
      )}

      <div className="card p-4 mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <input className="input" placeholder="Search candidate, email, position…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" value={jobOpeningId} onChange={(e) => setJobOpeningId(e.target.value)}>
          <option value="">All openings</option>
          {openings.map((o: any) => <option key={o.id} value={o.id}>{o.title}</option>)}
        </select>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn-ghost justify-start" onClick={() => { setSearch(""); setJobOpeningId(""); setStatus(""); }}>Clear filters</button>
      </div>

      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(r) => r.id}
          loading={isLoading}
          empty="No applications match your filters."
          mobileTitle={(r) => r.candidate?.fullName}
          mobileMeta={(r) => (
            <>
              <div>{r.applicationCode} · {r.jobOpening?.title}</div>
              <div>{r.candidate?.email} · {r.candidate?.mobile || "—"}</div>
            </>
          )}
          mobileActions={(r) => (
            <>
              <button className="btn-xs btn-outline" onClick={() => changeStatus(r.id, "SHORTLISTED")} disabled={r.status === "SHORTLISTED"}>Shortlist</button>
              <button className="btn-xs btn-outline" onClick={() => { if (window.confirm("Mark as SELECTED?")) changeStatus(r.id, "SELECTED"); }} disabled={!["SHORTLISTED", "INTERVIEW_COMPLETED", "INTERVIEW_SCHEDULED"].includes(r.status)}>Select</button>
              <button className="btn-xs btn-outline" onClick={() => { const x = window.prompt("Rejection reason:") ?? undefined; changeStatus(r.id, "REJECTED", x); }} disabled={r.status === "REJECTED"}>Reject</button>
              <button className="btn-xs btn-outline" onClick={() => { const x = window.prompt("Hold reason:") ?? ""; changeStatus(r.id, "ON_HOLD", x); }} disabled={r.status === "ON_HOLD"}>Hold</button>
              {r.resumeFileId && <button className="btn-xs btn-ghost" onClick={() => viewCV(r.resumeFileId)}>View CV</button>}
            </>
          )}
        />
      </div>
    </div>
  );
}
