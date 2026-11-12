import { useEffect, useState, type FormEvent } from "react";
import { hrApi } from "../../lib/api";

export default function Settings() {
  const [weights, setWeights] = useState<any>({});
  const [valid, setValid] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      hrApi.settingsWeights().then((r: any) => { setWeights(r.data.weights); setValid(r.data.valid); setForm({ skills: String(r.data.weights.skills || ""), experience: String(r.data.weights.experience || ""), qualification: String(r.data.weights.qualification || ""), domain: String(r.data.weights.domain || ""), certification: String(r.data.weights.certification || "") }); }).catch(() => setWeights({})),
      hrApi.integrationStatus().then((r: any) => setStatus(r.data)).catch(() => setStatus({})),
    ]).finally(() => setLoading(false));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setMessage("");
    try {
      await hrApi.updateSettingsWeights({ skills: Number(form.skills), experience: Number(form.experience), qualification: Number(form.qualification), domain: Number(form.domain), certification: Number(form.certification) });
      setMessage("Weights saved.");
      const r = await hrApi.settingsWeights();
      setWeights(r.data.weights); setValid(r.data.valid); setForm({ skills: String(r.data.weights.skills), experience: String(r.data.weights.experience), qualification: String(r.data.weights.qualification), domain: String(r.data.weights.domain), certification: String(r.data.weights.certification) });
    } catch (err: any) { setMessage(err.response?.data?.error?.message || "Save failed."); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-surface p-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-xl font-bold ink-body mb-6">Settings</h2>
      {loading ? <div className="h-64 flex items-center justify-center ink-soft">Loadingâ€¦</div> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="font-bold ink-body mb-4">AI Scoring Weights</h3>
            <p className="text-sm ink-soft mb-4">Weights must total 100. Used to rank candidates against job openings.</p>
            <form onSubmit={submit} className="space-y-3">
              {Object.entries(form).map(([k, v]) => (
                <div key={k} className="flex flex-col gap-1">
                  <label className="text-sm font-medium ink-soft">{k.charAt(0).toUpperCase() + k.slice(1)} (%)</label>
                  <input className="input" type="number" value={v} onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
              <p className="text-xs ink-soft">Total: {Object.values(form).reduce((a, b) => a + Number(b || 0), 0)} {valid ? "" : "(must equal 100)"}</p>
              <button className="btn-primary" disabled={saving}>{saving ? "Savingâ€¦" : "Save Weights"}</button>
              {message && <p className={`text-sm mt-2 ${message.startsWith("Weights") ? "text-[#146c43]" : "text-red-700"}`}>{message}</p>}
            </form>
          </div>
          <div className="card p-6">
            <h3 className="font-bold ink-body mb-4">Integration Status</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center"><span className="text-sm ink-soft">Google Drive</span><span className={`text-xs font-medium ${status.googleDrive ? "text-[#146c43]" : "ink-soft"}`}>{status.googleDrive ? "Enabled" : "Not configured"}</span></div>
              <div className="flex justify-between items-center"><span className="text-sm ink-soft">Google Sheets</span><span className={`text-xs font-medium ${status.googleSheets ? "text-[#146c43]" : "ink-soft"}`}>{status.googleSheets ? "Enabled" : "Not configured"}</span></div>
              <div className="flex justify-between items-center"><span className="text-sm ink-soft">SMTP Email</span><span className={`text-xs font-medium ${status.smtp ? "text-[#146c43]" : "ink-soft"}`}>{status.smtp ? "Configured" : "Simulated (dev)"}</span></div>
              <div className="flex justify-between items-center"><span className="text-sm ink-soft">OCR</span><span className={`text-xs font-medium ${status.ocr ? "text-[#146c43]" : "ink-soft"}`}>{status.ocr ? "Enabled" : "Disabled"}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

