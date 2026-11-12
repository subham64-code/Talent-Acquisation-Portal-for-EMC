import { useMemo, useState } from "react";
import { hrApi } from "../../lib/api";
import { useApiQuery, useInvalidate } from "../../hooks/useApiQuery";
import DataTable, { type Column } from "../../components/DataTable";

type Tab = "SUBMITTED" | "PENDING";

const STATUS_TONE: Record<string, string> = {
  NOT_UPLOADED: "border-[#171717]/15 bg-[#171717]/5 ink-soft",
  UPLOADED: "border-[#198754]/30 bg-[#198754]/10 text-[#198754]/80",
  UNDER_REVIEW: "border-[#8BC34A]/40 bg-[#8BC34A]/10 text-[#5E8C31]",
  ACCEPTED: "border-[#198754]/30 bg-[#198754]/10 text-[#198754]/80",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
  REUPLOAD_REQUIRED: "border-orange-200 bg-orange-50 text-orange-800",
};
const STATUS_LABEL: Record<string, string> = {
  NOT_UPLOADED: "Not uploaded", UPLOADED: "Uploaded", UNDER_REVIEW: "Under review",
  ACCEPTED: "Accepted", REJECTED: "Rejected", REUPLOAD_REQUIRED: "Re-upload requested",
};

export default function Onboarding() {
  const [tab, setTab] = useState<Tab>("SUBMITTED");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const invalidate = useInvalidate();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [onboardingId, setOnboardingId] = useState<string | null>(null);

  const { data: docs = [], isLoading } = useApiQuery<any[]>(
    ["documents", "all"],
    () => hrApi.documents({ page: 1, pageSize: 200 }).then((r: any) => r?.data?.items ?? []),
  );
  const { data: readyApps = [] } = useApiQuery<any[]>(
    ["onboarding", "ready"],
    () =>
      Promise.all(
        ["OFFER_ACCEPTED", "DOCUMENTS_PENDING", "DOCUMENTS_UNDER_REVIEW"].map((status) =>
          hrApi.applications({ page: 1, pageSize: 20, status }).then((r: any) => r?.data?.items ?? []),
        ),
      ).then((lists) => lists.flat()),
  );
  const visibleReady = readyApps.filter((a) => !dismissed.has(a.id));

  const addToExisting = async (app: any) => {
    const name = app.candidate?.fullName ?? "This candidate";
    if (!window.confirm(`Add ${name} to Existing Employees?\n\nThis creates a new employee record (reusing the offer details and CV) and marks the application as HIRED.`)) return;
    setOnboardingId(app.id);
    setError("");
    try {
      await hrApi.onboardEmployeeFromApplication(app.id);
      setMessage(`${name} added to Existing Employees.`);
      setDismissed(new Set([...dismissed, app.id]));
      invalidate(["documents", "dashboard", "employees", "pipeline"]);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not add the employee.");
    } finally {
      setOnboardingId(null);
    }
  };

  const keepInPipeline = (app: any) => {
    setDismissed(new Set([...dismissed, app.id]));
    setMessage(`${app.candidate?.fullName ?? "Candidate"} stays in the recruitment pipeline.`);
  };

  const submitted = useMemo(() => docs.filter((d) => ["UPLOADED", "UNDER_REVIEW", "REJECTED", "ACCEPTED"].includes(d.status)), [docs]);
  const pending = useMemo(() => docs.filter((d) => ["NOT_UPLOADED", "REUPLOAD_REQUIRED"].includes(d.status)), [docs]);
  const rows = tab === "SUBMITTED" ? submitted : pending;

  const verify = async (id: string, status: "ACCEPTED" | "REJECTED" | "REUPLOAD_REQUIRED") => {
    const remarks = status === "ACCEPTED" ? window.prompt("Verification remarks (optional):") || undefined : window.prompt(status === "REJECTED" ? "Reason for rejection:" : "What needs to be re-uploaded?") || undefined;
    try {
      await hrApi.verifyDocument(id, { status, remarks: remarks ?? null });
      setMessage(`Document marked ${STATUS_LABEL[status] ?? status}.`);
      invalidate(["documents", "dashboard"]);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Verification failed.");
    }
  };

  const remind = async (id: string) => {
    try {
      await hrApi.remindDocument(id);
      setMessage("Reminder email queued for the candidate.");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not send reminder.");
    }
  };

  const view = async (fileId: string) => {
    try {
      const r = await hrApi.fileAccessToken(fileId);
      window.open(r.data.url, "_blank");
    } catch {
      setError("Cannot open this document.");
    }
  };

  const columns: Column<any>[] = [
    { key: "idx", header: "#", render: (_r, i) => <span className="ink-soft">{i + 1}</span> },
    { key: "cand", header: "Candidate", render: (d) => <span className="font-medium ink-body">{d.application?.candidate?.fullName}</span> },
    { key: "code", header: "Application ID", hideOnMobile: true, render: (d) => <span className="font-mono text-xs ink-soft">{d.application?.applicationCode}</span> },
    { key: "cat", header: "Document", render: (d) => <span className="ink-soft">{d.category?.name}</span> },
    { key: "req", header: "Required", hideOnMobile: true, render: (d) => d.category?.isRequired ? <span className="text-[10px] font-bold uppercase text-[#F28C28]">Yes</span> : <span className="ink-soft text-xs">No</span> },
    { key: "status", header: "Verification", render: (d) => <span className={`badge whitespace-nowrap ${STATUS_TONE[d.status] || STATUS_TONE.NOT_UPLOADED}`}>{STATUS_LABEL[d.status] || d.status}</span> },
    { key: "at", header: "Updated", hideOnMobile: true, render: (d) => <span className="ink-soft text-xs">{d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString() : "—"}</span> },
    {
      key: "actions", header: "Actions",
      render: (d) => (
        <div className="flex gap-1 flex-wrap">
          {d.fileId && <button className="btn-xs btn-ghost whitespace-nowrap" onClick={() => view(d.fileId)}>View</button>}
          {tab === "SUBMITTED" && d.status !== "ACCEPTED" && <button className="btn-xs btn-outline whitespace-nowrap" onClick={() => verify(d.id, "ACCEPTED")}>Accept</button>}
          <button className="btn-xs btn-outline whitespace-nowrap" onClick={() => verify(d.id, "REUPLOAD_REQUIRED")}>Re-upload</button>
          {tab === "SUBMITTED" && <button className="btn-xs btn-ghost whitespace-nowrap text-red-600" onClick={() => verify(d.id, "REJECTED")}>Reject</button>}
          {tab === "PENDING" && <button className="btn-xs btn-ghost whitespace-nowrap" onClick={() => remind(d.id)}>Remind</button>}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen surface-app p-4 sm:p-6 lg:p-8">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold ink-body tracking-tight">Onboarding Documents</h1>
        <p className="text-sm ink-soft mt-0.5">Verify accepted offers and chase pending document submissions.</p>
      </div>

      {message && (
        <div className="mb-4 rounded-lg bg-[#198754]/10 border border-[#198754]/25 px-4 py-2.5 text-sm text-[#198754] flex items-start justify-between gap-3">
          <span>{message}</span><button onClick={() => setMessage("")} className="font-bold">×</button>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800 flex items-start justify-between gap-3">
          <span>{error}</span><button onClick={() => setError("")} className="font-bold">×</button>
        </div>
      )}

      {visibleReady.length > 0 && (
        <div className="card p-4 sm:p-5 mb-5 border border-[#198754]/30">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="font-extrabold ink-body">Ready for onboarding</h2>
              <p className="text-xs ink-soft">These accepted candidates can now be added to your employee register.</p>
            </div>
            <span className="badge border-[#198754]/30 bg-[#198754]/10 text-[#198754]/80">{visibleReady.length} ready</span>
          </div>
          <ul className="divide-y divide-[#171717]/8">
            {visibleReady.map((a) => (
              <li key={a.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-full bg-[#198754]/15 text-[#198754] font-extrabold flex items-center justify-center shrink-0">
                    {(a.candidate?.fullName || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold ink-body truncate">{a.candidate?.fullName}</p>
                    <p className="text-[11px] ink-soft truncate">{a.jobOpening?.title} · {a.jobOpening?.department?.name ?? "—"} · <span className="font-mono">{a.applicationCode}</span></p>
                    <p className="text-[11px] ink-soft">{a.candidate?.qualification ?? "—"} · {a.candidate?.totalExperience ?? 0} yrs exp</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button className="btn-primary btn-xs sm:text-sm" disabled={onboardingId === a.id} onClick={() => addToExisting(a)}>
                    {onboardingId === a.id ? "Adding…" : "Yes — Add to Existing"}
                  </button>
                  <button className="btn-ghost btn-xs sm:text-sm" onClick={() => keepInPipeline(a)}>No — Keep in Pipeline</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-1 p-1 rounded-xl bg-[#171717]/5 mb-5 w-full sm:w-auto">
        <button onClick={() => setTab("SUBMITTED")} className={`px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${tab === "SUBMITTED" ? "surface-card ink-body shadow-sm" : "ink-soft"}`}>
          Accepted / Submitted <span className="ml-1 text-[#198754] font-bold">{submitted.length}</span>
        </button>
        <button onClick={() => setTab("PENDING")} className={`px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${tab === "PENDING" ? "surface-card ink-body shadow-sm" : "ink-soft"}`}>
          Pending / Not Uploaded <span className="ml-1 text-[#F28C28] font-bold">{pending.length}</span>
        </button>
      </div>

      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={isLoading}
          empty={tab === "SUBMITTED" ? "No submitted documents await review." : "Everyone is up to date — no pending uploads."}
          mobileTitle={(d) => d.application?.candidate?.fullName}
          mobileMeta={(d) => (
            <>
              <div>{d.category?.name} · {STATUS_LABEL[d.status] || d.status}</div>
              <div>{d.application?.applicationCode}</div>
            </>
          )}
          mobileActions={(d) => (
            <>
              {d.fileId && <button className="btn-xs btn-ghost" onClick={() => view(d.fileId)}>View</button>}
              {d.status !== "ACCEPTED" && <button className="btn-xs btn-outline" onClick={() => verify(d.id, "ACCEPTED")}>Accept</button>}
              {tab === "PENDING" && <button className="btn-xs btn-ghost" onClick={() => remind(d.id)}>Remind</button>}
            </>
          )}
        />
      </div>
    </div>
  );
}
