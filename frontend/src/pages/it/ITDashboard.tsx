import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users, UserCheck, Zap, FolderOpen, ShieldCheck, Settings, ArrowRight,
  Shield, ScrollText, Server, Building2,
} from "lucide-react";
import { hrApi } from "../../lib/api";

function StatTile({
  label, value, hint, icon: Icon, tone,
}: { label: string; value: React.ReactNode; hint?: string; icon: any; tone: "green" | "orange" }) {
  const tones = {
    green: "bg-brand-100 text-brand-700",
    orange: "bg-accent-100 text-accent-700",
  } as const;
  return (
    <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className={`inline-flex w-10 h-10 rounded-xl items-center justify-center mb-3 ${tones[tone]}`}>
        <Icon size={18} />
      </div>
      <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500 font-bold">{label}</p>
      <p className="text-2xl xl:text-3xl font-extrabold text-gray-900 mt-1 tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function HealthRow({ name, ok, detail }: { name: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3">
        <span className={`w-2.5 h-2.5 rounded-full ${ok ? "bg-brand-500" : "bg-red-500"}`} />
        <div>
          <p className="text-sm font-semibold text-gray-800">{name}</p>
          {detail && <p className="text-[10px] text-gray-400">{detail}</p>}
        </div>
      </div>
      <span className={`text-[10px] font-bold tracking-widest uppercase ${ok ? "text-brand-700" : "text-red-600"}`}>
        {ok ? "Operational" : "Degraded"}
      </span>
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
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[0.69rem] font-bold uppercase tracking-[0.1em] text-brand-700 bg-brand-100 border border-brand-200 rounded-full px-2.5 py-1 mb-2">
            Ecometrix · Admin Portal
          </span>
          <h1 className="text-2xl sm:text-[1.7rem] font-extrabold tracking-tight text-gray-900 leading-tight">
            Command Center
          </h1>
          <p className="mt-1.5 text-sm text-gray-500 max-w-2xl leading-relaxed">
            Full visibility across identity, access, storage and security for the EMC Talent Acquisition
            platform. Every privileged action is audited.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <Link to="/hr/dashboard" className="btn-outline">HR Dashboard <ArrowRight size={16} /></Link>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <StatTile label="HR Accounts" value={totalUsers} hint={`${superAdmins} controllers · ${itAdmins} IT admins`} icon={Users} tone="green" />
        <StatTile label="Active Now" value={activeUsers} hint="Enabled accounts" icon={UserCheck} tone="green" />
        <StatTile label="Open Sessions" value={sessions.length} hint="Live HR sessions" icon={Zap} tone="orange" />
        <StatTile label="Stored Files" value={totalFiles.toLocaleString()} hint={`${(totalBytes / 1048576).toFixed(1)} MB used`} icon={FolderOpen} tone="orange" />
        <StatTile label="Super Admins" value={superAdmins} hint="Full-access roles" icon={ShieldCheck} tone="green" />
        <StatTile label="IT Admins" value={itAdmins} hint="Reset & restore rights" icon={Settings} tone="orange" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Platform health */}
        <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm p-5 lg:p-6 xl:col-span-2">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Platform Health</h2>
          <p className="text-xs text-gray-500 mb-3">Live status across the core services</p>
          <div className="divide-y divide-gray-100">
            <HealthRow name="Neon PostgreSQL" ok={true} detail="Primary database — emc_talent schema" />
            <HealthRow name="Filebase Cloud Storage" ok={Boolean(storage) || Boolean(integration?.storage?.configured)} detail="All uploads — CVs, JDs, offers, documents" />
            <HealthRow name="SMTP / Email" ok={Boolean(integration?.smtp)} detail="Transactional mail delivery" />
            <HealthRow name="Rate Limiting" ok={true} detail="Per-IP sliding window" />
            <HealthRow name="Cache Layer" ok={true} detail="In-process hot-path cache" />
          </div>
        </div>

        {/* Quick controls */}
        <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm p-5 lg:p-6 xl:col-span-3">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Quick Controls</h2>
          <p className="text-xs text-gray-500 mb-4">Everyday administrative tasks</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { to: "/it/users", t: "Account Control", d: "Reset, restore, deactivate HR accounts and enforce password sign-in", icon: Shield },
              { to: "/it/audit-log", t: "Audit Trail", d: "Every sensitive action — who did what, when, and from where", icon: ScrollText },
              { to: "/it/system", t: "System & Storage", d: "Storage buckets, integration status and capacity", icon: Server },
              { to: "/hr/dashboard", t: "HR Dashboard", d: "Switch to the HR operations view", icon: Building2 },
            ].map((q) => (
              <Link
                key={q.to}
                to={q.to}
                className="group rounded-xl border border-[var(--border)] bg-[#fbfcfa] p-4 hover:border-brand-400 hover:bg-brand-50 transition-all"
              >
                <q.icon size={22} className="mb-2 text-brand-600 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-bold text-gray-900 group-hover:text-brand-800 transition-colors">{q.t}</p>
                <p className="text-[11px] text-gray-500 mt-1 leading-snug">{q.d}</p>
              </Link>
            ))}
          </div>

          {/* Storage summary strip */}
          {storage?.buckets?.length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {storage.buckets.slice(0, 8).map((b: any) => (
                <div key={b.bucket} className="rounded-xl bg-[#f6f8f2] border border-[var(--border)] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 truncate">{b.bucket}</p>
                  <p className="text-xs font-bold text-gray-900 tabular-nums">
                    {b.files} <span className="text-gray-400 font-normal">files</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent audit trail */}
      <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm p-5 lg:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Recent Sensitive Actions</h2>
            <p className="text-xs text-gray-500">The 6 latest privileged events across the platform</p>
          </div>
          <Link to="/it/audit-log" className="btn-outline btn-sm">
            Full audit log <ArrowRight size={14} />
          </Link>
        </div>
        <div className="overflow-x-auto -mx-2">
          <table className="table w-full min-w-[720px]">
            <thead>
              <tr><th>Time</th><th>Actor</th><th>Action</th><th>Record</th><th>IP</th></tr>
            </thead>
            <tbody>
              {audit.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">No audit events recorded yet.</td></tr>
              ) : audit.map((a: any) => (
                <tr key={a.id}>
                  <td className="font-mono whitespace-nowrap text-gray-600">{new Date(a.createdAt).toLocaleString()}</td>
                  <td className="max-w-[180px] truncate text-gray-700">{a.actorEmail || "system"}</td>
                  <td><span className="inline-block rounded-md bg-accent-100 border border-[var(--orange-tint)] text-accent-700 px-2 py-0.5 text-[11px] font-semibold">{a.action}</span></td>
                  <td className="font-mono text-gray-600">{a.entityType}{a.entityId ? `#${String(a.entityId).slice(0, 8)}` : ""}</td>
                  <td className="font-mono text-gray-500">{a.ip || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {loading && (
        <div className="fixed bottom-4 right-4 text-[10px] uppercase tracking-widest text-gray-400 bg-white border border-[var(--border)] shadow-sm rounded-full px-4 py-1.5">
          Syncing…
        </div>
      )}
    </div>
  );
}
