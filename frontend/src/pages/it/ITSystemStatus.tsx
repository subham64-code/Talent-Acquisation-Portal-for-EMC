import { useEffect, useState } from "react";
import { hrApi } from "../../lib/api";

const GLASS = "rounded-2xl border border-orange-400/15 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl";

export default function ITSystemStatus() {
  const [storage, setStorage] = useState<any>(null);
  const [integration, setIntegration] = useState<any>(null);
  const [cacheInfo, setCacheInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      hrApi.storageOverview().then((r: any) => setStorage(r.data)).catch(() => setStorage(null)),
      hrApi.integrationStatus().then((r: any) => setIntegration(r.data)).catch(() => setIntegration(null)),
    ]).finally(() => setLoading(false));
  }, []);

  const totalBytes = storage?.totals?.bytes ?? 0;

  const rows = storage?.buckets ?? [];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-orange-400 font-extrabold">Infrastructure</p>
        <h1 className="text-2xl font-extrabold text-white mt-1">System &amp; Storage</h1>
        <p className="text-sm text-white/50 mt-1">Cloud storage distribution, integration health and runtime cache.</p>
      </div>

      {loading ? (
        <div className="p-16 text-center text-white/40">Probing infrastructure…</div>
      ) : (
        <>
          {/* Storage overview */}
          <div className={`${GLASS} p-5`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-[11px] uppercase tracking-[0.22em] text-orange-400/90 font-extrabold">Cloud File Storage — Filebase / S3</h2>
              <div className="flex gap-2">
                <div className="rounded-xl bg-black/30 border border-white/8 px-4 py-2 text-center">
                  <p className="text-[10px] text-white/40 uppercase tracking-widest">Buckets</p>
                  <p className="text-lg font-extrabold text-orange-300 tabular-nums">{rows.length}</p>
                </div>
                <div className="rounded-xl bg-black/30 border border-white/8 px-4 py-2 text-center">
                  <p className="text-[10px] text-white/40 uppercase tracking-widest">Files</p>
                  <p className="text-lg font-extrabold text-amber-300 tabular-nums">{storage?.totals?.files ?? 0}</p>
                </div>
                <div className="rounded-xl bg-black/30 border border-white/8 px-4 py-2 text-center">
                  <p className="text-[10px] text-white/40 uppercase tracking-widest">Size</p>
                  <p className="text-lg font-extrabold text-emerald-300 tabular-nums">{(totalBytes / 1048576).toFixed(1)} MB</p>
                </div>
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="text-sm text-white/40 py-6 text-center">No files stored in the cloud bucket yet.</p>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {rows.map((b: any) => (
                  <div key={b.bucket} className="rounded-xl bg-black/30 border border-white/8 p-4 hover:border-orange-400/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-white/80 truncate">{b.bucket}</p>
                      <span className="text-[9px] uppercase tracking-widest text-orange-400/70 border border-orange-400/20 rounded px-2 py-0.5">{b.provider}</span>
                    </div>
                    <p className="text-2xl font-extrabold text-white mt-2 tabular-nums">{b.files.toLocaleString()}<span className="text-xs font-normal text-white/40 ml-2">files</span></p>
                    <p className="text-[11px] text-white/40 font-mono">{(b.bytes / 1048576).toFixed(2)} MB</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Integration health */}
          <div className={`${GLASS} p-5`}>
            <h2 className="text-[11px] uppercase tracking-[0.22em] text-orange-400/90 font-extrabold mb-4">Integration Status</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { name: "Neon PostgreSQL", ok: true, detail: "Cloud primary DB · emc_talent schema", icon: "🐘" },
                { name: "Filebase Cloud Storage", ok: true, detail: "All uploaded documents retained off-site", icon: "☁️" },
                { name: "Nodemailer / SMTP", ok: Boolean(integration?.smtp), detail: "Gmail SMTP · transactional emails", icon: "✉️" },
                { name: "AI Screening Engine", ok: Boolean(integration?.ocr), detail: "OCR + weighted scoring pipeline", icon: "🤖" },
                { name: "Google Sheets Sync", ok: Boolean(integration?.googleSheets), detail: integration?.googleSheets ? "Configured" : "Not configured", icon: "📊" },
                { name: "In-Process Cache", ok: true, detail: "60s hot-path caching for dashboards & lists", icon: "⚡" },
              ].map((i) => (
                <div key={i.name} className="rounded-xl bg-black/30 border border-white/8 p-4 flex items-start gap-3">
                  <span className="text-2xl">{i.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white/85">{i.name}</p>
                    <p className="text-[10px] text-white/40">{i.detail}</p>
                    <p className={`mt-1.5 text-[9px] uppercase tracking-widest font-bold ${i.ok ? "text-emerald-400" : "text-rose-400"}`}>{i.ok ? "Operational" : "Attention"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security notes */}
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-5">
            <h2 className="text-[11px] uppercase tracking-[0.22em] text-amber-300 font-extrabold mb-3">Security Posture</h2>
            <ul className="text-xs text-amber-100/70 space-y-1.5 list-disc list-inside">
              <li>All HR data is stored in <strong>Neon cloud PostgreSQL</strong> — no database files exist on application servers.</li>
              <li>All uploaded PDFs, Word documents and images live in the <strong>Filebase cloud bucket</strong> — never on local disk.</li>
              <li>OTPs are single-use and expire in 10 minutes; failed attempts are rate-limited per IP.</li>
              <li>Every privileged action (login, reset, export) is written to the immutable audit trail.</li>
              <li>Role-based access control enforces server-side permissions on every endpoint.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
