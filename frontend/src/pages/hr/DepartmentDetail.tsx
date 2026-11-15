import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from "recharts";
import { hrApi } from "../../lib/api";

const STAGES = [
  { key: "APPLIED", label: "Applied", color: "#171717" },
  { key: "UNDER_REVIEW", label: "Under Review", color: "#5C5C5C" },
  { key: "SHORTLISTED", label: "Shortlisted", color: "#659616" },
  { key: "INTERVIEW_SCHEDULED", label: "Interview", color: "#8BC34A" },
  { key: "SELECTED", label: "Selected", color: "#FF9412" },
  { key: "HIRED", label: "Hired", color: "#E5810A" },
  { key: "REJECTED", label: "Rejected", color: "#E4E7E5" },
  { key: "ON_HOLD", label: "On Hold", color: "#A3A3A3" },
];

export default function DepartmentDetail() {
  const { id } = useParams();
  const [detail, setDetail] = useState<any>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      hrApi.dashboardDepartment(id!).then((r: any) => setDetail(r.data)).catch(() => setDetail(null)),
      hrApi.applications({ departmentId: id, page: 1, pageSize: 200 }).then((r: any) => setApps(r.data.items ?? [])).catch(() => setApps([])),
    ]).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center surface-app ink-soft">Loading department…</div>;
  if (!detail) return <div className="p-8 ink-soft">Department not found.</div>;

  const dept = detail.department;
  const employees = detail.employees ?? [];
  const byType: Record<string, number> = {};
  employees.forEach((e: any) => {
    const t = e.employmentType?.name || "Other";
    byType[t] = (byType[t] || 0) + 1;
  });
  const typeData = Object.entries(byType).map(([name, value]) => ({ name, value }));
  const empChart = [
    { name: "Total", value: employees.length, fill: "#659616" },
    { name: "Openings", value: detail.activeOpenings ?? 0, fill: "#FF9412" },
    { name: "Applicants", value: detail.totalApplicants ?? 0, fill: "#171717" },
    { name: "Shortlisted", value: detail.shortlisted ?? 0, fill: "#8BC34A" },
    { name: "Selected", value: detail.selected ?? 0, fill: "#E5810A" },
  ];
  const stageData = STAGES.map((s) => ({ name: s.label, value: apps.filter((a: any) => a.status === s.key).length, fill: s.color }));

  return (
    <div className="min-h-screen surface-app p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <Link to="/hr/dashboard" className="text-xs font-semibold text-[#659616] hover:underline">← Dashboard</Link>
          <h1 className="text-2xl font-extrabold ink-body mt-1">{dept.name}</h1>
          <p className="text-xs ink-soft">{dept.code} · {dept.description}</p>
        </div>
        <Link to="/hr/submissions" className="btn-sm btn-outline">View all submissions</Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
        {[
          { label: "Employees", value: employees.length, color: "ink-body" },
          { label: "Active Openings", value: detail.activeOpenings ?? 0, color: "text-[#FF9412]" },
          { label: "Applicants", value: detail.totalApplicants ?? 0, color: "ink-body" },
          { label: "Shortlisted", value: detail.shortlisted ?? 0, color: "text-[#659616]" },
          { label: "Selected", value: detail.selected ?? 0, color: "text-[#E5810A]" },
        ].map((k) => (
          <div key={k.label} className="card p-4">
            <p className="text-xs ink-soft">{k.label}</p>
            <p className={`text-2xl font-extrabold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5 mb-6">
        <div className="card p-5 xl:col-span-2">
          <h3 className="font-bold ink-body mb-4">Recruitment Pipeline — {dept.name}</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E9ECEA" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#5C5C5C" }} axisLine={false} tickLine={false} interval={0} angle={-18} textAnchor="end" height={54} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#5C5C5C" }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "#65961608" }} contentStyle={{ borderRadius: 10, border: "1px solid #E9ECEA", fontSize: 12 }} />
                <Bar dataKey="value" name="Candidates" radius={[6, 6, 0, 0]}>
                  {stageData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-bold ink-body mb-4">Headcount Summary</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={empChart} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E9ECEA" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#5C5C5C" }} axisLine={false} tickLine={false} interval={0} angle={-18} textAnchor="end" height={54} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#5C5C5C" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E9ECEA", fontSize: 12 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {empChart.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {typeData.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {typeData.map((t) => (
                <span key={t.name} className="badge border-[#171717]/15 bg-[#171717]/5 ink-soft">
                  {t.name}: {t.value}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-bold ink-body mb-4">Applications in {dept.name}</h3>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>#</th><th>Candidate</th><th>Position</th><th>Status</th><th>Applied</th></tr>
            </thead>
            <tbody>
              {apps.map((a: any, i: number) => (
                <tr key={a.id}>
                  <td className="ink-soft">{i + 1}</td>
                  <td className="font-medium ink-body">{a.candidate?.fullName}</td>
                  <td className="ink-soft">{a.jobOpening?.title}</td>
                  <td><span className="badge border-[#659616]/30 bg-[#659616]/10 text-[#659616]/80">{String(a.status).replace(/_/g, " ")}</span></td>
                  <td className="ink-soft text-xs">{new Date(a.appliedAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {apps.length === 0 && <tr><td colSpan={5} className="text-center py-6 ink-soft">No applications for this department yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
