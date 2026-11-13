import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { hrApi } from "../../lib/api";
import DataTable, { type Column } from "../../components/DataTable";

const TONE: Record<string, string> = {
  DRAFT: "border-[#171717]/15 bg-[#171717]/5 ink-soft",
  SENT: "border-[#F28C28]/30 bg-[#F28C28]/10 text-[#F28C28]/80",
  ACCEPTED: "border-[#198754]/30 bg-[#198754]/10 text-[#198754]/80",
  VIEWED: "border-[#8BC34A]/40 bg-[#8BC34A]/10 text-[#5E8C31]",
  DECLINED: "border-red-200 bg-red-50 text-red-700",
  EXPIRED: "border-[#171717]/15 bg-[#171717]/5 ink-soft",
  WITHDRAWN: "border-[#171717]/15 bg-[#171717]/5 ink-soft",
};

export default function Offers() {
  const [items, setItems] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ status: "DRAFT" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [searchParams] = useSearchParams();

  const load = () => {
    hrApi.offers({ page: 1, pageSize: 100 }).then((r: any) => setItems(r.data.items ?? r.data)).catch(() => setItems([]));
  };

  useEffect(() => {
    const appId = searchParams.get("applicationId");
    if (appId) {
      setForm((p) => ({ ...p, applicationId: appId }));
      setShowCreate(true);
    }
  }, [searchParams]);

  useEffect(() => {
    Promise.all([
      hrApi.offers({ page: 1, pageSize: 100 }).then((r: any) => setItems(r.data.items ?? r.data)).catch(() => setItems([])),
      hrApi.applications({ page: 1, pageSize: 100, status: "SELECTED" }).then((r: any) => setApplications(r.data.items ?? r.data)).catch(() => setApplications([])),
      hrApi.employmentTypes().then((r: any) => setTypes(r.data.items ?? r.data)).catch(() => setTypes([])),
    ]).finally(() => setLoading(false));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await hrApi.createOffer(form);
      setShowCreate(false);
      setForm({ status: "DRAFT" });
      setMessage("Offer letter created as a draft.");
      load();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Offer creation failed.");
    } finally { setSaving(false); }
  };

  const generatePdf = async (id: string) => {
    try {
      await hrApi.generateOfferPdf(id);
      setMessage("Offer letter PDF generated.");
      load();
    } catch (err: any) { setError(err.response?.data?.error?.message || "PDF generation failed."); }
  };

  const send = async (id: string) => {
    if (!confirm("Send the offer letter to the candidate by email?")) return;
    try {
      await hrApi.sendOffer(id);
      setMessage("Offer letter sent.");
      load();
    } catch (err: any) { setError(err.response?.data?.error?.message || "Send failed."); }
  };

  const viewPdf = async (fileId: string) => {
    try {
      const r = await hrApi.fileAccessToken(fileId);
      window.open(r.data.url, "_blank");
    } catch { setError("Could not open the offer letter."); }
  };

  const columns: Column<any>[] = [
    { key: "idx", header: "#", render: (_r, i) => <span className="ink-soft">{i + 1}</span> },
    { key: "cand", header: "Candidate", render: (o) => <span className="font-medium ink-body">{o.application?.candidate?.fullName}</span> },
    { key: "pos", header: "Position", hideOnMobile: true, render: (o) => <span className="ink-soft">{o.application?.jobOpening?.title}</span> },
    { key: "desig", header: "Designation", render: (o) => <span className="ink-soft">{o.designation}</span> },
    { key: "ctc", header: "CTC", hideOnMobile: true, render: (o) => <span className="ink-soft">{o.ctc != null ? o.ctc.toLocaleString() : "—"}</span> },
    { key: "join", header: "Joining", hideOnMobile: true, render: (o) => <span className="ink-soft text-xs">{o.joiningDate ? new Date(o.joiningDate).toLocaleDateString() : "—"}</span> },
    { key: "status", header: "Status", render: (o) => <span className={`badge whitespace-nowrap ${TONE[o.status]}`}>{o.status}</span> },
    {
      key: "actions", header: "Actions",
      render: (o) => (
        <div className="flex gap-1">
          {!o.pdfFileId && <button className="btn-xs btn-outline whitespace-nowrap" onClick={() => generatePdf(o.id)}>Generate PDF</button>}
          {o.pdfFileId && <button className="btn-xs btn-ghost whitespace-nowrap" onClick={() => viewPdf(o.pdfFileId)}>View PDF</button>}
          {o.pdfFileId && o.status === "DRAFT" && <button className="btn-xs btn-primary whitespace-nowrap" onClick={() => send(o.id)}>Send</button>}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen surface-app p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-extrabold ink-body tracking-tight">Offer Letters</h1>
          <p className="text-sm ink-soft mt-0.5">Generate, send and track EMC offers.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>{showCreate ? "Cancel" : "+ Create Offer"}</button>
      </div>

      {(error || message) && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${error ? "bg-orange-50 border-orange-200 text-orange-800" : "bg-[#198754]/10 border-[#198754]/25 text-[#198754]"}`}>
          {error || message}
        </div>
      )}

      {showCreate && (
        <div className="card p-5 mb-5">
          <h3 className="font-bold ink-body mb-4">Create Offer Letter</h3>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
                <label className="text-sm font-semibold ink-soft">Candidate (selected)</label>
                <select className="input" required value={form.applicationId || ""} onChange={(e) => setForm((p) => ({ ...p, applicationId: e.target.value }))}>
                  <option value="">Select candidate…</option>
                  {applications.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.candidate?.fullName} — {a.jobOpening?.title}</option>
                  ))}
                </select>
                {applications.length === 0 && (
                  <p className="text-[11px] text-[#F28C28]">No selected candidates yet. Mark applications as SELECTED from View Submissions or from Interview Scheduling — they will appear here immediately.</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Designation *</label>
                <input className="input" required value={form.designation || ""} onChange={(e) => setForm((p) => ({ ...p, designation: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Annual CTC</label>
                <input className="input" type="number" value={form.ctc || ""} onChange={(e) => setForm((p) => ({ ...p, ctc: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Employment type</label>
                <select className="input" value={form.employmentTypeId || ""} onChange={(e) => setForm((p) => ({ ...p, employmentTypeId: e.target.value }))}>
                  <option value="">Select…</option>
                  {types.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Joining date</label>
                <input className="input" type="date" value={form.joiningDate || ""} onChange={(e) => setForm((p) => ({ ...p, joiningDate: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Work location</label>
                <input className="input" value={form.workLocation || ""} onChange={(e) => setForm((p) => ({ ...p, workLocation: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Reporting to</label>
                <input className="input" value={form.reportingTo || ""} onChange={(e) => setForm((p) => ({ ...p, reportingTo: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Offer expiry</label>
                <input className="input" type="date" value={form.expiryDate || ""} onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold ink-soft">Additional conditions</label>
              <textarea className="input" rows={2} value={form.additionalConditions || ""} onChange={(e) => setForm((p) => ({ ...p, additionalConditions: e.target.value }))} />
            </div>
            <button className="btn-primary" disabled={saving}>{saving ? "Creating…" : "Create Draft Offer"}</button>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(r) => r.id}
          loading={loading}
          empty="No offer letters yet."
          mobileTitle={(o) => o.application?.candidate?.fullName}
          mobileMeta={(o) => (
            <>
              <div>{o.designation} · {o.application?.jobOpening?.title}</div>
              <div>CTC {o.ctc != null ? o.ctc.toLocaleString() : "—"} · joining {o.joiningDate ? new Date(o.joiningDate).toLocaleDateString() : "—"}</div>
            </>
          )}
          mobileActions={(o) => (
            <>
              {!o.pdfFileId && <button className="btn-xs btn-outline" onClick={() => generatePdf(o.id)}>Generate PDF</button>}
              {o.pdfFileId && <button className="btn-xs btn-ghost" onClick={() => viewPdf(o.pdfFileId)}>View PDF</button>}
              {o.pdfFileId && o.status === "DRAFT" && <button className="btn-xs btn-primary" onClick={() => send(o.id)}>Send</button>}
            </>
          )}
        />
      </div>
    </div>
  );
}
