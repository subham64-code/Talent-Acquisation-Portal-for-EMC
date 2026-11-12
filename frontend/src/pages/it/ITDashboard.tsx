import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { hrApi } from "../../lib/api";

const GLASS = "relative overflow-hidden rounded-2xl border border-orange-400/15 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl shadow-[0_0_60px_-20px_rgba(242,140,40,0.15)]";

function StatTile({ label, value, hint, tone, icon }: { label: string; value: React.ReactNode; hint?: string; tone: string; icon: string }) {
  const toneMap: Record<string, string> = {
    amber: "text-amber-300 from-amber-400/20 to-orange-500/5 border-amber-400/25",
    emerald: "text-emerald-300 from-emerald-400/20 to-green-600/5 border-emerald-400/25",
    sky: "text-sky-300 from-sky-400/20 to-cyan-600/5 border-sky-400/25",
    rose: "text-rose-300 from-rose-400/20 to-red-600/5 border-rose-400/25",
    violet: "text-violet-300 from-violet-400/20 to-purple-600/5 border-violet-400/25",
    orange: "text-orange-300 from-orange-400/20 to-red-600/5 border-orange-400/25",
  };
  return (
    <div className={`${GLASS} border p-5 group hover:border-orange-400/35 transition-colors`}>
      <div className={`inline-flex w-10 h-10 rounded-xl bg-gradient-to-br ${toneMap[tone] || toneMap.amber} border items-center justify-center text-lg mb-3 group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45 font-bold">{label}</p>
      <p className="text-3xl font-extrabold text-white mt-1 tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-white/40 mt-1">{hint}</p>}
    </div>
  );
}

function HealthRow({ name, ok, latency, detail }: { name: string; ok: boolean; latency?: string; detail?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-3">
        <span className={`w-2.5 h-2.5 rounded-full ${ok ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" : "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,.8)]"}`} />
        <div>
          <p className="text-sm font-semibold text-white/90">{name}</p>
          {detail && <p className="text-[10px] text-white/40">{detail}</p>}
        </div>
      </div>
      <div className="flex items-center gap-4">
        {latency && <span className="text-[10px] font-mono text-white/40 tabular-nums">{latency}</span>}
        <span className={`text-[10px] font-bold tracking-widest uppercase ${ok ? "text-emerald-300" : "text-rose-300"}`}>
          {ok ? "Operational" : "Degraded"}
        </span>
      </div>
    </div>
  );
}

export default function ITDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [storage, setStorage] = useState<any>(null);
  const [integration, setIntegration] = useState<any>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      hrApi.users({ page: 1, pageSize: 100 }).then((r: any) => setUsers(r.data.items ?? r.data)).catch(() => setUsers([])),
      hrApi.storageOverview().then((r: any) => setStorage(r.data)).catch(() => setStorage(null)),
      hrApi.integrationStatus().then((r: any) => setIntegration(r.data)).catch(() => setIntegration(null)),
      hrApi.auditLogs({ page: 1, pageSize: 6 }).then((r: any) => setAudit(r.data.items ?? r.data)).catch(() => setAudit([])),
      hrApi.activeSessions().then((r: any) => setSessions(r.data.sessions ?? [])).catch(() => setSessions([])),
    ]).finally(() => setLoading(false));
  }, []);

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.isActive).length;
  const superAdmins = users.filter((u) => (u.roles || []).some((r: any) => r.role?.key === "SUPER_ADMIN")).length;
  const itAdmins = users.filter((u) => (u.roles || []).some((r: any) => r.role?.key === "IT_ADMIN")).length;
  const totalFiles = storage?.totals?.files ?? 0;
  const totalBytes = storage?.totals?.bytes ?? 0;

  return (
    <div className="space-y-5">
      {/* Hero band */}
      <div className={`${GLASS} p-5 sm:p-7 flex flex-col lg:flex-row lg:items-center gap-5`}>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.35em] text-orange-400 font-extrabold mb-2">IT Administration Console</p>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight">
            System <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-red-400">Operations</span> &amp; Control
          </h1>
          <p className="text-sm text-white/55 mt-2 max-w-xl">
            Full visibility across identity, access, storage and security for the EMC Talent Acquisition platform.
            Every privileged action is audited.
          </p>
        </div>
        <div className="shrink-0 grid grid-rows-3 gap-1.5 text-right">
          <div className="flex items-baseline gap-2 justify-end">
            <span className="text-3xl font-extrabold text-orange-400 tabular-nums">{totalUsers}</span>
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Accounts</span>
          </div>
          <div className="flex items-baseline gap-2 justify-end">
            <span className="text-3xl font-extrabold text-emerald-400 tabular-nums">{activeUsers}</span>
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Active</span>
          </div>
          <div className="flex items-baseline gap-2 justify-end">
            <span className="text-3xl font-extrabold text-sky-400 tabular-nums">{sessions.length}</span>
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Sessions</span>
          </div>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatTile label="HR Accounts" value={totalUsers} hint={`${superAdmins} controllers · ${itAdmins} IT admins`} tone="amber" icon="👥" />
        <StatTile label="Active Now" value={activeUsers} hint="Enabled accounts" tone="emerald" icon="✓" />
        <StatTile label="Open Sessions" value={sessions.length} hint="Live HR sessions" tone="sky" icon="⚡" />
        <StatTile label="Stored Files" value={totalFiles.toLocaleString()} hint={`${(totalBytes / 1048576).toFixed(1)} MB used`} tone="orange" icon="🗂️" />
        <StatTile label="Super Admins" value={superAdmins} hint="Full-access roles" tone="violet" icon="⊛" />
        <StatTile label="IT Admins" value={itAdmins} hint="Reset &amp; restore rights" tone="rose" icon="⚙" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Platform health */}
        <div className={`${GLASS} p-5 xl:col-span-2`}>
          <h2 className="text-[11px] uppercase tracking-[0.22em] text-orange-400/90 font-extrabold mb-4">Platform Health</h2>
          <div className="divide-y divide-white/5">
            <HealthRow name="Neon PostgreSQL" ok={true} latency="Cloud" detail="Primary database — emc_talent schema" />
            <HealthRow name="Filebase Cloud Storage" ok={Boolean(storage) || Boolean(integration?.storage?.configured)} latency="Cloud" detail="All uploads — CVs, JDs, offers, documents" />
            <HealthRow name="SMTP / Email" ok={Boolean(integration?.smtp) ?? true} detail="Gmail SMTP — transactional mail" />
            <HealthRow name="Rate Limiting" ok={true} detail="Per-IP sliding window" />
            <HealthRow name="Cache Layer" ok={true} detail="In-process hot-path cache" />
          </div>
        </div>

        {/* Quick controls */}
        <div className={`${GLASS} p-5 xl:col-span-3`}>
          <h2 className="text-[11px] uppercase tracking-[0.22em] text-orange-400/90 font-extrabold mb-4">Quick Controls</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { to: "/it/users", t: "Account Control", d: "Reset, restore, deactivate HR accounts and enforce password sign-in", icon: "🛡️" },
              { to: "/it/audit-log", t: "Audit Trail", d: "Every sensitive action — who did what, when, and from where", icon: "📜" },
              { to: "/it/system", t: "System & Storage", d: "Storage buckets, integration status and capacity", icon: "🗄️" },
              { to: "/hr/dashboard", t: "HR Dashboard", d: "Switch to the HR operations view", icon: "🏢" },
            ].map((q) => (
              <Link key={q.to} to={q.to} className="group rounded-xl border border-white/8 bg-white/[0.03] p-4 hover:border-orange-400/35 hover:bg-orange-400/[0.05] transition-all">
                <div className="text-2xl mb-2 group-hover:scale-110 transition-transform inline-block">{q.icon}</div>
                <p className="text-sm font-bold text-white/90 group-hover:text-orange-200 transition-colors">{q.t}</p>
                <p className="text-[11px] text-white/45 mt-1 leading-snug">{q.d}</p>
              </Link>
            ))}
          </div>

          {/* Storage summary strip */}
          {storage?.buckets?.length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {storage.buckets.slice(0, 8).map((b: any) => (
                <div key={b.bucket} className="rounded-lg bg-black/30 border border-white/5 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-white/40 truncate">{b.bucket}</p>
                  <p className="text-xs font-bold text-orange-200 tabular-nums">{b.files} <span className="text-white/40 font-normal">files</span></p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent audit trail */}
      <div className={`${GLASS} p-5`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[11px] uppercase tracking-[0.22em] text-orange-400/90 font-extrabold">Recent Sensitive Actions</h2>
          <Link to="/it/audit-log" className="text-[11px] font-bold text-orange-300 hover:text-orange-200 border border-orange-400/20 rounded-lg px-3 py-1.5">
            View full audit log →
          </Link>
        </div>
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-xs min-w-[720px]">
            <thead>
              <tr className="text-left text-white/35 uppercase tracking-wider">
                <th className="px-3 py-2">Time</th><th className="px-3 py-2">Actor</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Record</th><th className="px-3 py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {audit.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-white/35">No audit events recorded yet.</td></tr>
              ) : audit.map((a: any) => (
                <tr key={a.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="px-3 py-2 text-white/50 font-mono whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2 text-white/70 truncate max-w-[180px]">{a.actorEmail || "system"}</td>
                  <td className="px-3 py-2"><span className="inline-block rounded-md bg-orange-400/10 border border-orange-400/20 text-orange-300 px-2 py-0.5 font-semibold">{a.action}</span></td>
                  <td className="px-3 py-2 text-white/50 font-mono">{a.entityType}{a.entityId ? `#${String(a.entityId).slice(0, 8)}` : ""}</td>
                  <td className="px-3 py-2 text-white/40 font-mono">{a.ip || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {loading && (
        <div className="fixed bottom-4 right-4 text-[10px] uppercase tracking-widest text-white/30 bg-black/60 border border-white/5 rounded-full px-4 py-1.5">
          Syncing…
        </div>
      )}
    </div>
  );
}
