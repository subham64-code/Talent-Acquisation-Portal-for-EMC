import { useEffect, useState } from "react";
import {
  Database, Cloud, Mail, ScanSearch, Table, Zap, ShieldAlert,
} from "lucide-react";
import { hrApi } from "../../lib/api";

export default function ITSystemStatus() {
  const [storage, setStorage] = useState<any>(null);
  const [integration, setIntegration] = useState<any>(null);
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
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <span className="inline-flex items-center gap-1.5 text-[0.69rem] font-bold uppercase tracking-[0.1em] text-brand-700 bg-brand-100 border border-brand-200 rounded-full px-2.5 py-1 mb-2">
          Ecometrix · Admin Portal
        </span>
        <h1 className="text-2xl sm:text-[1.7rem] font-extrabold tracking-tight text-gray-900 leading-tight">System &amp; Storage</h1>
        <p className="mt-1.5 text-sm text-gray-500 max-w-2xl leading-relaxed">
          Cloud storage distribution, integration health and runtime services.
        </p>
      </div>

      {loading ? (
        <div className="p-16 text-center text-gray-400">Probing infrastructure…</div>
      ) : (
        <>
          {/* Storage overview */}
          <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm p-5 lg:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Cloud File Storage</h2>
                <p className="text-xs text-gray-500">Filebase / S3-compatible bucket distribution</p>
              </div>
              <div className="flex gap-2">
                <div className="rounded-xl bg-[#f6f8f2] border border-[var(--border)] px-4 py-2 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">Buckets</p>
                  <p className="text-lg font-extrabold text-gray-900 tabular-nums">{rows.length}</p>
                </div>
                <div className="rounded-xl bg-[#f6f8f2] border border-[var(--border)] px-4 py-2 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">Files</p>
                  <p className="text-lg font-extrabold text-gray-900 tabular-nums">{storage?.totals?.files ?? 0}</p>
                </div>
                <div className="rounded-xl bg-[#f6f8f2] border border-[var(--border)] px-4 py-2 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">Size</p>
                  <p className="text-lg font-extrabold text-gray-900 tabular-nums">{(totalBytes / 1048576).toFixed(1)} MB</p>
                </div>
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">No files stored in the cloud bucket yet.</p>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {rows.map((b: any) => (
                  <div key={b.bucket} className="rounded-xl bg-[#fbfcfa] border border-[var(--border)] p-4 hover:border-brand-400 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-gray-800 truncate">{b.bucket}</p>
                      <span className="text-[9px] uppercase tracking-widest text-brand-700 bg-brand-100 border border-brand-200 rounded px-2 py-0.5 shrink-0">{b.provider}</span>
                    </div>
                    <p className="text-2xl font-extrabold text-gray-900 mt-2 tabular-nums">{b.files.toLocaleString()}<span className="text-xs font-normal text-gray-400 ml-2">files</span></p>
                    <p className="text-[11px] text-gray-500 font-mono">{(b.bytes / 1048576).toFixed(2)} MB</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Integration health */}
          <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm p-5 lg:p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Integration Status</h2>
            <p className="text-xs text-gray-500 mb-4">External services connected to the platform</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { name: "Neon PostgreSQL", ok: true, detail: "Cloud primary DB · emc_talent schema", icon: Database },
                { name: "Filebase Cloud Storage", ok: true, detail: "All uploaded documents retained off-site", icon: Cloud },
                { name: "Nodemailer / SMTP", ok: Boolean(integration?.smtp), detail: "Transactional emails", icon: Mail },
                { name: "AI Screening Engine", ok: Boolean(integration?.ocr), detail: "OCR + weighted scoring pipeline", icon: ScanSearch },
                { name: "Google Sheets Sync", ok: Boolean(integration?.googleSheets), detail: integration?.googleSheets ? "Configured" : "Not configured", icon: Table },
                { name: "In-Process Cache", ok: true, detail: "60s hot-path caching for dashboards & lists", icon: Zap },
              ].map((i) => (
                <div key={i.name} className="rounded-xl bg-[#fbfcfa] border border-[var(--border)] p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-brand-100 border border-brand-200 flex items-center justify-center text-brand-700 shrink-0">
                    <i.icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{i.name}</p>
                    <p className="text-[10px] text-gray-400">{i.detail}</p>
                    <p className={`mt-1.5 text-[9px] uppercase tracking-widest font-bold ${i.ok ? "text-brand-700" : "text-red-600"}`}>{i.ok ? "Operational" : "Attention"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security notes */}
          <div className="rounded-2xl border border-[var(--orange-tint)] bg-accent-50 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-accent-700 mb-3">
              <ShieldAlert size={16} /> Security Posture
            </h2>
            <ul className="text-xs text-amber-900/80 space-y-1.5 list-disc list-inside">
              <li>All HR data is stored in <strong>Neon cloud PostgreSQL</strong> — no database files exist on application servers.</li>
              <li>All uploaded PDFs, Word documents and images live in the <strong>Filebase cloud bucket</strong> — never on local disk.</li>
              <li>OTPs are single-use and expire quickly; failed attempts are rate-limited per IP.</li>
              <li>Every privileged action (login, reset, export) is written to the immutable audit trail.</li>
              <li>Role-based access control enforces server-side permissions on every endpoint.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
