import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { hrApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useApiQuery, queryKeys } from "../../hooks/useApiQuery";
import Logo from "../../components/Logo";

const PIE_COLORS = ["#198754", "#F28C28", "#8BC34A", "#D97417", "#2BA56D", "#FBBF24", "#34D399", "#94A3B8"];

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function Kpi({
  label, value, sub, icon, tone, trend, to,
}: { label: string; value: React.ReactNode; sub?: string; icon: string; tone: "green" | "orange" | "dark" | "amber"; trend?: string; to?: string }) {
  const tones = {
    green: { ring: "ring-emerald-500/20", chip: "bg-emerald-500/10 text-emerald-600", bar: "from-emerald-500/20 to-emerald-500/0" },
    orange: { ring: "ring-orange-500/20", chip: "bg-orange-500/10 text-orange-600", bar: "from-orange-500/20 to-orange-500/0" },
    dark: { ring: "ring-slate-500/20", chip: "bg-slate-500/10 text-slate-700", bar: "from-slate-500/20 to-slate-500/0" },
    amber: { ring: "ring-amber-400/25", chip: "bg-amber-400/15 text-amber-700", bar: "from-amber-400/25 to-amber-400/0" },
  } as const;
  const t = tones[tone];
  const body = (
    <div className={`card card-hover relative overflow-hidden p-4 sm:p-5 ring-1 ${t.ring}`}>
      <div className={`absolute inset-x-0 top-0 h-16 bg-gradient-to-b ${t.bar} pointer-events-none`} />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)] truncate">{label}</p>
          <p className="mt-1.5 text-2xl sm:text-[28px] leading-none font-extrabold text-[var(--ink)] tabular-nums">{value}</p>
          {sub && <p className="mt-1.5 text-[10px] sm:text-[11px] text-[var(--muted)] truncate">{sub}</p>}
          {trend && <p className="mt-1 text-[10px] font-bold text-emerald-600">{trend}</p>}
        </div>
        <span className={`shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-2xl ${t.chip} flex items-center justify-center text-xl shadow-sm`}>{icon}</span>
      </div>
    </div>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-[#198754] to-[#146C43]" />
        <h3 className="font-extrabold text-[var(--ink)] tracking-tight truncate">{children}</h3>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: overview, isLoading } = useApiQuery<any>(
    queryKeys.dashboardOverview,
    () => hrApi.dashboardOverview(),
  );
  const { data: departments = [] } = useApiQuery<any[]>(
    queryKeys.dashboardDepartments,
    () => hrApi.dashboardDepartments().then((r: any) => r?.data?.departments ?? []),
  );
  const { data: pipeline = [] } = useApiQuery<any[]>(
    ["dashboard", "pipeline"],
    () => hrApi.applications({ page: 1, pageSize: 500 }).then((r: any) => r?.data?.items ?? []),
  );

  const funnelStages = [
    { key: "APPLIED", label: "Applied", color: "#171717" },
    { key: "UNDER_REVIEW", label: "Review", color: "#64748B" },
    { key: "SHORTLISTED", label: "Shortlisted", color: "#198754" },
    { key: "INTERVIEW_SCHEDULED", label: "Interview", color: "#8BC34A" },
    { key: "SELECTED", label: "Selected", color: "#F28C28" },
    { key: "HIRED", label: "Hired", color: "#D97417" },
  ];

  const { funnelData, deptChart, pieData, areaData, topDepartments } = useMemo(() => {
    const funnel = funnelStages.map((s) => ({
      name: s.label,
      value: pipeline.filter((a: any) => a.status === s.key).length,
      fill: s.color,
    }));
    const dept = departments.slice(0, 10).map((d: any) => ({
      name: d.name.length > 16 ? d.name.slice(0, 15) + "…" : d.name,
      employees: Number(d.totalEmployees ?? 0),
      openings: Number(d.activeOpenings ?? 0),
    }));
    const statusCounts: Record<string, number> = {};
    pipeline.forEach((a: any) => { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; });
    const pie = Object.entries(statusCounts).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
    const monthly: Record<string, number> = {};
    pipeline.forEach((a: any) => {
      const k = new Date(a.appliedAt).toLocaleString("en-US", { month: "short" });
      monthly[k] = (monthly[k] || 0) + 1;
    });
    const area = Object.entries(monthly).map(([month, count]) => ({ month, count }));
    const top = [...departments].sort((a, b) => Number(b.totalEmployees ?? 0) - Number(a.totalEmployees ?? 0)).slice(0, 8);
    return { funnelData: funnel, deptChart: dept, pieData: pie, areaData: area, topDepartments: top };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline, departments]);

  if (isLoading && !overview) {
    return (
      <div className="min-h-screen flex items-center justify-center surface-app">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#198754]/20 border-t-[#198754] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-[var(--muted)]">Preparing your dashboard…</p>
        </div>
      </div>
    );
  }
  if (!overview) return <div className="p-8 text-[var(--muted)]">No dashboard data available.</div>;

  return (
    <div className="min-h-screen surface-app p-3 sm:p-5 lg:p-7">
      {/* ============ HERO / WELCOME BAND ============ */}
      <div className="relative overflow-hidden rounded-2xl gradient-hero border border-white/10 p-5 sm:p-7 text-white shadow-xl mb-6">
        <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#198754]/25 blur-3xl animate-pulse-soft" />
        <div className="pointer-events-none absolute -bottom-28 left-24 w-72 h-72 rounded-full bg-[#F28C28]/20 blur-3xl animate-pulse-soft" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center p-2 shadow-lg shrink-0">
            <Logo size={48} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#8BC34A]">EMC Talent Acquisition Portal</p>
            <h1 className="mt-1 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight">
              {timeGreeting()},{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-[#F28C28] to-orange-400">{user?.name?.split(" ")[0]}</span>
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-white/60">
              Here is what is moving across EMC today. Live figures pulled from the cloud database.
            </p>
          </div>
          <div className="shrink-0 flex flex-wrap gap-2">
            <Link to="/hr/ai-screening" className="btn-accent text-xs sm:text-sm">Run AI Screening</Link>
            <Link to="/hr/openings" className="btn text-xs sm:text-sm text-white bg-white/10 hover:bg-white/15 border border-white/20">Openings</Link>
          </div>
        </div>
      </div>

      {/* ============ KPI GRID ============ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Kpi label="Total Employees" value={overview.totalEmployees} sub={`${overview.existingEmployees} existing · ${overview.formerEmployees} former`} icon="👥" tone="green" to="/hr/employees" />
        <Kpi label="Departments" value={overview.totalDepartments} sub="Tap any department below" icon="🏢" tone="orange" to="/hr/departments" />
        <Kpi label="Active Openings" value={overview.activeJobOpenings} sub={`${overview.closedJobOpenings} closed`} icon="📣" tone="amber" to="/hr/openings" />
        <Kpi label="Applications" value={overview.totalApplications} sub="All-time submissions" icon="📄" tone="dark" to="/hr/submissions" />
        <Kpi label="Pipeline" value={overview.pipelineCandidates} sub={`${overview.candidatesOnHold} on hold`} icon="🔄" tone="green" to="/hr/databank" />
        <Kpi label="Shortlisted" value={overview.shortlistedCandidates} sub="Ready for interview" icon="⭐" tone="orange" to="/hr/submissions" />
        <Kpi label="Interviews" value={overview.interviewsScheduled} sub="Scheduled sessions" icon="🗓️" tone="dark" to="/hr/interviews" />
        <Kpi label="Selected / Hired" value={`${overview.selectedCandidates} / ${overview.hiredEmployees}`} sub={`${overview.pendingOffers} offers pending`} icon="🎯" tone="green" to="/hr/offers" />
      </div>

      {/* ============ CHART ROW ============ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5 mb-6">
        <div className="card p-4 sm:p-6 xl:col-span-2">
          <SectionTitle right={<span className="text-[10px] font-bold uppercase tracking-widest ink-muted">Live</span>}>
            Recruitment Pipeline
          </SectionTitle>
          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,140,131,.25)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} interval={0} angle={-16} textAnchor="end" height={52} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "rgba(25,135,84,.08)" }} contentStyle={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12, color: "var(--ink)" }} />
                <Bar dataKey="value" name="Candidates" radius={[8, 8, 0, 0]} maxBarSize={54} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <SectionTitle>Status Mix</SectionTitle>
          <div className="h-64 sm:h-72 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={84} paddingAngle={3} strokeWidth={2} stroke="var(--card)">
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12, color: "var(--ink)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} layout="vertical" verticalAlign="middle" align="right" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4 sm:p-6 xl:col-span-2">
          <SectionTitle>Applications Over Time</SectionTitle>
          <div className="h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#198754" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#198754" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,140,131,.25)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12, color: "var(--ink)" }} />
                <Area type="monotone" dataKey="count" name="Applications" stroke="#198754" strokeWidth={2.5} fill="url(#areaGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <SectionTitle>Workforce vs Openings</SectionTitle>
          <div className="h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptChart} layout="vertical" margin={{ top: 0, right: 10, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(128,140,131,.25)" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 10, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12, color: "var(--ink)" }} />
                <Bar dataKey="employees" name="Employees" fill="#198754" radius={[0, 6, 6, 0]} barSize={10} />
                <Bar dataKey="openings" name="Openings" fill="#F28C28" radius={[0, 6, 6, 0]} barSize={10} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ============ DEPARTMENT DRILL-DOWN TABLE ============ */}
      <div className="card p-4 sm:p-6 overflow-hidden">
        <SectionTitle right={<Link to="/hr/departments" className="text-xs font-bold text-[#198754] hover:underline">View all →</Link>}>
          Department Pipeline
        </SectionTitle>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="table min-w-[640px]">
            <thead>
              <tr><th>Department</th><th>Employees</th><th>Openings</th><th>Applicants</th><th className="text-right">Drill down</th></tr>
            </thead>
            <tbody>
              {topDepartments.map((d: any) => (
                <tr
                  key={d.id}
                  onClick={() => navigate(`/hr/departments/${d.id}`)}
                  className="cursor-pointer hover:bg-[rgba(25,135,84,.06)] transition-colors"
                >
                  <td className="font-semibold text-[var(--ink)]">{d.name}</td>
                  <td><span className="badge badge-green">{Number(d.totalEmployees ?? 0)}</span></td>
                  <td><span className="badge badge-orange">{Number(d.activeOpenings ?? 0)}</span></td>
                  <td className="ink-soft">{Number(d.totalApplicants ?? 0)}</td>
                  <td className="text-right text-xs font-bold text-[#198754]">Open →</td>
                </tr>
              ))}
              {topDepartments.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 ink-muted">No departments yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
