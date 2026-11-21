import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BellRing, CheckCircle2, Database, Mail, RotateCcw, Save, Settings2, ShieldCheck, Sparkles } from "lucide-react";
import { hrApi } from "../../lib/api";
import PageHeading from "../../components/ref/PageHeading";
import Badge from "../../components/ref/Badge";
import Button from "../../components/ref/Button";
import { Input } from "../../components/ref/Input";

const DEFAULT_PREFERENCES = { notifications: true, weekly: true, compact: false };
const DEFAULT_WEIGHTS = { skills: 40, experience: 25, qualification: 15, domain: 10, certification: 10 };
const WEIGHT_LABELS: Record<string, string> = { skills: "Technical skills", experience: "Experience depth", qualification: "Qualification", domain: "Domain expertise", certification: "Certifications" };
const PREFERENCES: Array<{ key: keyof typeof DEFAULT_PREFERENCES; title: string; description: string }> = [
  { key: "notifications", title: "Workflow notifications", description: "Receive updates when openings, interviews and approvals change." },
  { key: "weekly", title: "Weekly operating summary", description: "Show a Monday summary of open tasks and pending approvals." },
  { key: "compact", title: "Compact navigation", description: "Keep the HR workspace groups condensed when the panel opens." },
];

const payloadOf = (response: any) => response?.data?.data ?? response?.data ?? {};

export default function Settings() {
  const [form, setForm] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(DEFAULT_WEIGHTS).map(([key, value]) => [key, String(value)])));
  const [status, setStatus] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [preferences, setPreferences] = useState<Record<string, boolean>>(DEFAULT_PREFERENCES);

  const total = useMemo(() => Object.values(form).reduce((sum, value) => sum + Number(value || 0), 0), [form]);
  const aiReady = total === 100 && Object.values(form).every((value) => /^\d+(\.\d+)?$/.test(value.trim()));

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("emc:hr-workspace:preferences");
      if (stored) setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(stored) });
    } catch {
      setPreferences(DEFAULT_PREFERENCES);
    }
    Promise.allSettled([hrApi.settingsWeights(), hrApi.integrationStatus()])
      .then(([weightsResult, statusResult]) => {
        if (weightsResult.status === "fulfilled") {
          const payload = payloadOf(weightsResult.value);
          const nextWeights = payload.weights ?? DEFAULT_WEIGHTS;
          setForm(Object.fromEntries(Object.entries({ ...DEFAULT_WEIGHTS, ...nextWeights }).map(([key, value]) => [key, String(value)])));
        }
        if (statusResult.status === "fulfilled") setStatus(payloadOf(statusResult.value));
      })
      .finally(() => setLoading(false));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!aiReady) {
      setError("AI weights must total exactly 100 before saving.");
      return;
    }
    setSaving(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, Number(value)]));
      const response = await hrApi.updateSettingsWeights(payload);
      const saved = payloadOf(response);
      const savedWeights = saved.weights ?? payload;
      setForm(Object.fromEntries(Object.entries({ ...DEFAULT_WEIGHTS, ...savedWeights }).map(([key, value]) => [key, String(value)])));
      setMessage("AI scoring weights saved.");
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "AI weight update failed.");
    } finally {
      setSaving(false);
    }
  };

  const togglePreference = (key: keyof typeof DEFAULT_PREFERENCES) => setPreferences((current) => ({ ...current, [key]: !current[key] }));
  const savePreferences = () => {
    try { window.localStorage.setItem("emc:hr-workspace:preferences", JSON.stringify(preferences)); setMessage("Workspace preferences saved on this device."); }
    catch { setError("Could not save preferences on this device."); }
  };
  const resetWeights = () => setForm(Object.fromEntries(Object.entries(DEFAULT_WEIGHTS).map(([key, value]) => [key, String(value)])));

  if (loading) {
    return <div className="page"><PageHeading eyebrow="HR workspace / Settings" title="Settings" description="Loading your operational configuration…" action={<Settings2 size={22} />} /><section className="card"><div className="loading-block"><div className="spinner" /> Loading settings…</div></section></div>;
  }

  return (
    <div className="page settings-page">
      <PageHeading
        eyebrow="HR workspace / 05"
        title="Settings"
        description="Workspace preferences, AI scoring weights and integration health for the HR operating rhythm."
        action={<Settings2 size={22} className="text-muted" />}
      />

      {(error || message) && <div className={`notice ${error ? "notice--error" : "notice--success"}`} role="status"><div className="notice__body"><div className="notice__title">{error || message}</div></div></div>}

      <div className="settings-layout">
        <section className="card settings-card">
          <div className="card__header">
            <div><h2 className="card__title">Workspace preferences</h2><p className="card__subtitle">Saved to this browser on this device; your HR identity and permissions stay unchanged.</p></div>
            <BellRing size={20} className="text-muted" aria-hidden="true" />
          </div>
          <div className="settings-card__body">
            {PREFERENCES.map((preference) => (
              <label className="settings-row" key={preference.key}>
                <span><strong>{preference.title}</strong><small>{preference.description}</small></span>
                <input type="checkbox" checked={Boolean(preferences[preference.key])} onChange={() => togglePreference(preference.key)} aria-label={preference.title} />
              </label>
            ))}
            <div className="form-actions"><Button icon={Save} onClick={savePreferences}>Save preferences</Button></div>
          </div>
        </section>

        <section className="card">
          <div className="card__header">
            <div><h2 className="card__title">Integration health</h2><p className="card__subtitle">Connected services for AI scoring, email and storage.</p></div>
            <Database size={20} className="text-muted" aria-hidden="true" />
          </div>
          <div className="settings-card__body settings-integration-list">
            {[
              ["SMTP email", status.smtp ? "Configured" : "Simulated (dev)", status.smtp, Mail],
              ["OCR processing", status.ocr ? "Enabled" : "Disabled", status.ocr, CheckCircle2],
              ["Cloud database", "Connected over HTTPS", true, Database],
              ["Object storage", status.filestorage ?? status.s3 ? "Connected" : "Local/simulated mode", status.filestorage ?? status.s3, ShieldCheck],
            ].map(([label, value, ok, Icon]: any) => (
              <div className="settings-row" key={String(label)}>
                <span className="settings-integration"><span className="settings-integration__icon"><Icon size={17} aria-hidden="true" /></span><span><strong>{String(label)}</strong><small>HR workflow integration status</small></span></span>
                <Badge variant={ok ? "green" : "grey"}>{String(value)}</Badge>
              </div>
            ))}
          </div>
        </section>

        <section className="card settings-ai-card">
          <div className="card__header">
            <div><h2 className="card__title"><Sparkles size={18} aria-hidden="true" /> AI scoring weights</h2><p className="card__subtitle">Weights determine how candidates are ranked against each opening. They must total exactly 100.</p></div>
            <Badge variant={aiReady ? "green" : "orange"}>{total}/100</Badge>
          </div>
          <form onSubmit={submit} className="settings-ai-card__body">
            {Object.entries(form).map(([key, value]) => (
              <label className="weight-control" key={key}>
                <div className="weight-control__head"><span>{WEIGHT_LABELS[key] ?? key}</span><strong>{value}%</strong></div>
                <div className="weight-control__input">
                  <input type="range" min={0} max={100} step={1} value={Number(value) || 0} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} aria-label={`${WEIGHT_LABELS[key] ?? key} weight`} />
                  <Input type="number" min={0} max={100} required value={value} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} aria-label={`${WEIGHT_LABELS[key] ?? key} percentage`} />
                </div>
              </label>
            ))}
            <div className={`weight-total ${aiReady ? "weight-total--valid" : "weight-total--invalid"}`}><span>Total</span><strong>{total}/100</strong><small>{aiReady ? "Ready to save" : "Adjust the values until the total is exactly 100"}</small></div>
            <div className="form-actions"><Button variant="ghost" icon={RotateCcw} type="button" onClick={resetWeights}>Reset defaults</Button><Button icon={Save} type="submit" disabled={!aiReady} loading={saving}>Save weights</Button></div>
          </form>
        </section>
      </div>
    </div>
  );
}
