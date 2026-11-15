import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { hrApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useApiQuery, queryKeys } from "../../hooks/useApiQuery";
import {
  Users, Building2, Briefcase, FileStack, UsersRound, Star, CalendarClock, Target, Sparkles,
} from "lucide-react";

const PIE_COLORS = ["#659616", "#FF9412", "#8BC34A", "#E5810A", "#84BD26", "#FBBF24", "#34D399", "#94A3B8"];

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function StatCard({
  label, value, meta, icon: Icon, variant, to,
}: { label: string; value: React.ReactNode; meta?: string; icon: any; variant?: "green" | "orange" | "grey"; to: string }) {
  return (
    <Link to={to} className={`stat-card ${variant === "orange" ? "stat-card--orange" : variant === "grey" ? "stat-card--grey" : ""}`} aria-label={`View ${label}`}>
      <span className="stat-card__icon"><Icon size={20} aria-hidden="true" /></span>
      <span className="min-w-0">
        <span className="stat-card__label block">{label}</span>
        <span className="stat-card__value block mt-0.5">{value}</span>
        {meta && <span className="stat-card__meta block mt-1">{meta}</span>}
      </span>
    </Link>
  );
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-[#659616] to-[#4C730D]" />
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
    { key: "SHORTLISTED", label: "Shortlisted", color: "#659616" },
    { key: "INTERVIEW_SCHEDULED", label: "Interview", color: "#8BC34A" },
    { key: "SELECTED", label: "Selected", color: "#FF9412" },
    { key: "HIRED", label: "Hired", color: "#E5810A" },
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
          <div className="w-10 h-10 border-4 border-[#659616]/20 border-t-[#659616] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-[var(--muted)]">Preparing your dashboard…</p>
        </div>
      </div>
    );
  }
  if (!overview) return <div className="p-8 text-[var(--muted)]">No dashboard data available.</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-7 flex flex-col gap-6">
      {/* ============ PAGE HEADER (Ashis-style) ============ */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="page-eyebrow">Ecometrix · Talent Acquisition</span>
          <h1 className="text-2xl sm:text-[1.7rem] font-extrabold tracking-tight leading-tight text-[var(--ink)]">
            Recruitment Dashboard
          </h1>
          <p className="mt-1.5 text-sm text-[var(--muted)] max-w-2xl leading-relaxed">
            {timeGreeting()}, {user?.name?.split(" ")[0]}. Live overview of the recruitment pipeline, upcoming interviews and hiring activity.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <Link to="/hr/ai-screening" className="btn-accent"><Sparkles size={16} />Run AI Screening</Link>
          <Link to="/hr/openings" className="btn-outline"><Briefcase size={16} />Openings</Link>
        </div>
      </div>

      {/* ============ STAT CARDS ============ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total Employees" value={overview.totalEmployees} meta={`${overview.existingEmployees} existing · ${overview.formerEmployees} former`} icon={Users} to="/hr/employees" />
        <StatCard label="Departments" value={overview.totalDepartments} meta="Browse department details" icon={Building2} variant="grey" to="/hr/departments" />
        <StatCard label="Active Openings" value={overview.activeJobOpenings} meta={`${overview.closedJobOpenings} closed`} icon={Briefcase} variant="orange" to="/hr/openings" />
        <StatCard label="Applications" value={overview.totalApplications} meta="All-time submissions" icon={FileStack} variant="grey" to="/hr/submissions" />
        <StatCard label="Pipeline" value={overview.pipelineCandidates} meta={`${overview.candidatesOnHold} on hold`} icon={UsersRound} to="/hr/databank" />
        <StatCard label="Shortlisted" value={overview.shortlistedCandidates} meta="Ready for interview" icon={Star} variant="orange" to="/hr/submissions" />
        <StatCard label="Interviews" value={overview.interviewsScheduled} meta="Scheduled sessions" icon={CalendarClock} variant="grey" to="/hr/interviews" />
        <StatCard label="Selected / Hired" value={`${overview.selectedCandidates} / ${overview.hiredEmployees}`} meta={`${overview.pendingOffers} offers pending`} icon={Target} to="/hr/offers" />
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
                <Tooltip cursor={{ fill: "rgba(122,180,27,.08)" }} contentStyle={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12, color: "var(--ink)" }} />
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
                    <stop offset="0%" stopColor="#659616" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#659616" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,140,131,.25)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12, color: "var(--ink)" }} />
                <Area type="monotone" dataKey="count" name="Applications" stroke="#659616" strokeWidth={2.5} fill="url(#areaGrad)" />
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
                <Bar dataKey="employees" name="Employees" fill="#659616" radius={[0, 6, 6, 0]} barSize={10} />
                <Bar dataKey="openings" name="Openings" fill="#FF9412" radius={[0, 6, 6, 0]} barSize={10} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ============ DEPARTMENT DRILL-DOWN TABLE ============ */}
      <div className="card p-4 sm:p-6 overflow-hidden">
        <SectionTitle right={<Link to="/hr/departments" className="text-xs font-bold text-[#659616] hover:underline">View all →</Link>}>
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
                  className="cursor-pointer hover:bg-[rgba(122,180,27,.06)] transition-colors"
                >
                  <td className="font-semibold text-[var(--ink)]">{d.name}</td>
                  <td><span className="badge badge-green">{Number(d.totalEmployees ?? 0)}</span></td>
                  <td><span className="badge badge-orange">{Number(d.activeOpenings ?? 0)}</span></td>
                  <td className="ink-soft">{Number(d.totalApplicants ?? 0)}</td>
                  <td className="text-right text-xs font-bold text-[#659616]">Open →</td>
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
