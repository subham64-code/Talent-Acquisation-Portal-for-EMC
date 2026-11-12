import { useEffect, useState, type FormEvent } from "react";
import { hrApi } from "../../lib/api";

const RESULT_OPTIONS = [
  { key: "SELECTED", label: "Selected", tone: "border-[#198754]/30 bg-[#198754]/10 text-[#198754]/80", icon: "✓" },
  { key: "NEXT_ROUND", label: "Next Round", tone: "border-[#8BC34A]/40 bg-[#8BC34A]/10 text-[#5E8C31]", icon: "→" },
  { key: "UNDER_REVIEW", label: "Under Review", tone: "border-[#F28C28]/30 bg-[#F28C28]/10 text-[#F28C28]/80", icon: "⟳" },
  { key: "REJECTED", label: "Rejected", tone: "border-red-200 bg-red-50 text-red-700", icon: "✕" },
  { key: "ON_HOLD", label: "On Hold", tone: "border-[#171717]/15 bg-[#171717]/5 ink-soft", icon: "⏸" },
];

export default function Interviews() {
  const [items, setItems] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ round: "Technical Round 1", mode: "ONLINE", timezone: "Asia/Kolkata" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [resultFor, setResultFor] = useState<any>(null);
  const [showNextRound, setShowNextRound] = useState(false);
  const [nextRoundName, setNextRoundName] = useState("");
  const [nextDate, setNextDate] = useState("");

  const load = () => {
    hrApi.interviews({ page: 1, pageSize: 100 }).then((r: any) => setItems(r.data.items ?? r.data)).catch(() => setItems([]));
  };

  useEffect(() => {
    Promise.all([
      hrApi.interviews({ page: 1, pageSize: 100 }).then((r: any) => setItems(r.data.items ?? r.data)).catch(() => setItems([])),
      hrApi.applications({ page: 1, pageSize: 100, status: "SHORTLISTED" }).then((r: any) => setApplications(r.data.items ?? r.data)).catch(() => setApplications([])),
    ]).finally(() => setLoading(false));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await hrApi.createInterview(form);
      setShowCreate(false);
      setForm({ round: "Technical Round 1", mode: "ONLINE", timezone: "Asia/Kolkata" });
      load();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to schedule interview.");
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id: string) => {
    if (!confirm("Cancel this interview?")) return;
    try { await hrApi.cancelInterview(id, {}); load(); } catch (err: any) { setError(err.response?.data?.error?.message || "Cancel failed."); }
  };

  const applyResult = async (key: string) => {
    if (!resultFor) return;
    try {
      await hrApi.interviewResult(resultFor.id, {
        result: key,
        remarks: resultFor.remarks || undefined,
        nextRound: key === "NEXT_ROUND" ? (nextRoundName.trim() || "Next Round") : undefined,
        nextScheduledAt: key === "NEXT_ROUND" && nextDate ? new Date(nextDate).toISOString() : undefined,
      });
      setResultFor(null);
      setShowNextRound(false);
      setNextRoundName("");
      setNextDate("");
      load();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not record the result.");
    }
  };

  return (
    <div className="min-h-screen surface-app p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold ink-body tracking-tight">Interview Scheduling</h1>
          <p className="text-sm ink-soft mt-0.5">Schedule rounds, record feedback and move candidates forward.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "+ Schedule Interview"}
        </button>
      </div>

      {error && <div className="mb-5 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800">{error}</div>}

      {showCreate && (
        <div className="card p-5 mb-5">
          <h3 className="font-bold ink-body mb-4">Schedule Interview</h3>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-sm font-semibold ink-soft">Candidate (shortlisted)</label>
                <select className="input" required value={form.applicationId || ""} onChange={(e) => setForm((p) => ({ ...p, applicationId: e.target.value }))}>
                  <option value="">Select candidate…</option>
                  {applications.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.candidate?.fullName} — {a.jobOpening?.title}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Round</label>
                <input className="input" value={form.round} onChange={(e) => setForm((p) => ({ ...p, round: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Date &amp; time</label>
                <input className="input" type="datetime-local" required value={form.scheduledAt || ""} onChange={(e) => setForm((p) => ({ ...p, scheduledAt: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Mode</label>
                <select className="input" value={form.mode} onChange={(e) => setForm((p) => ({ ...p, mode: e.target.value }))}>
                  <option value="ONLINE">Online</option>
                  <option value="OFFLINE">Offline</option>
                  <option value="PHONE">Phone</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Interviewer</label>
                <input className="input" value={form.interviewerName || ""} onChange={(e) => setForm((p) => ({ ...p, interviewerName: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Meeting link</label>
                <input className="input" type="url" value={form.meetingLink || ""} onChange={(e) => setForm((p) => ({ ...p, meetingLink: e.target.value }))} />
              </div>
            </div>
            <button className="btn-primary" disabled={saving}>{saving ? "Scheduling…" : "Schedule Interview"}</button>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#171717]/10 flex items-center justify-between">
          <h3 className="font-bold ink-body">Interviews</h3>
          <span className="text-xs ink-soft">{items.length} scheduled</span>
        </div>
        {loading ? (
          <div className="h-64 flex items-center justify-center ink-soft">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[900px]">
              <thead>
                <tr>
                  <th>#</th><th>Candidate</th><th>Position</th><th>Round</th><th>Date / Time</th>
                  <th>Mode</th><th>Interviewer</th><th>Status</th><th>Result</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i: any, idx: number) => (
                  <tr key={i.id}>
                    <td className="ink-soft">{idx + 1}</td>
                    <td className="font-medium ink-body">{i.application?.candidate?.fullName}</td>
                    <td className="ink-soft">{i.application?.jobOpening?.title}</td>
                    <td className="ink-soft">{i.round}</td>
                    <td className="ink-soft text-xs">{new Date(i.scheduledAt).toLocaleString()}</td>
                    <td><span className="badge border-[#171717]/15 bg-[#171717]/5 ink-soft">{i.mode}</span></td>
                    <td className="ink-soft">{i.interviewerName || "—"}</td>
                    <td><span className="badge border-[#171717]/15 bg-[#171717]/5 ink-soft">{i.status}</span></td>
                    <td className="ink-soft text-xs">{String(i.result || "PENDING").replace(/_/g, " ")}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {i.status !== "CANCELLED" && (
                          <button className="btn-xs btn-primary whitespace-nowrap" onClick={() => { setResultFor(i); setError(""); }}>
                            Record result
                          </button>
                        )}
                        {i.status !== "CANCELLED" && (
                          <button className="btn-xs btn-outline whitespace-nowrap" onClick={() => cancel(i.id)}>Cancel</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-8 ink-soft">No interviews scheduled yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Result modal */}
      {resultFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="card w-full max-w-lg p-6 shadow-2xl">
            <h3 className="text-lg font-extrabold ink-body mb-1">Interview Result</h3>
            <p className="text-sm ink-soft mb-5">
              {resultFor.application?.candidate?.fullName} · {resultFor.application?.jobOpening?.title} · {resultFor.round}
            </p>

            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-sm font-semibold ink-soft">Remarks</label>
              <textarea
                className="input"
                rows={2}
                defaultValue={resultFor.remarks || ""}
                onChange={(e) => setResultFor({ ...resultFor, remarks: e.target.value })}
                placeholder="Feedback shared with the candidate (optional)"
              />
            </div>

            {showNextRound && (
              <div className="grid grid-cols-2 gap-3 mb-4 p-3 rounded-lg bg-[#8BC34A]/10 border border-[#8BC34A]/25">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold ink-soft">Next round name</label>
                  <input className="input" value={nextRoundName} onChange={(e) => setNextRoundName(e.target.value)} placeholder="Technical Round 2" autoFocus />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold ink-soft">Schedule date</label>
                  <input className="input" type="datetime-local" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {RESULT_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  onClick={() => {
                    if (o.key === "NEXT_ROUND" && !showNextRound) {
                      setShowNextRound(true);
                      return;
                    }
                    applyResult(o.key);
                  }}
                  className={`px-3 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${o.tone} hover:opacity-80`}
                >
                  <span className="mr-1.5">{o.icon}</span>
                  {o.label}
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button className="btn-ghost" onClick={() => { setResultFor(null); setShowNextRound(false); setNextRoundName(""); setNextDate(""); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
