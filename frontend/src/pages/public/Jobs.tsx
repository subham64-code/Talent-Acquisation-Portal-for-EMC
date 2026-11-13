import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { hrApi } from "../../lib/api";
import Logo from "../../components/Logo";

export default function Jobs() {
  const navigate = useNavigate();
  const [openings, setOpenings] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchOpenings = async () => {
    setLoading(true);
    try {
      const r = await hrApi.publicOpenings({
        page: 1, pageSize: 100,
        search: search || undefined,
        departmentId: deptFilter || undefined,
      });
      setOpenings(Array.isArray(r?.data?.items) ? r.data.items : []);
    } catch { setOpenings([]); } finally { setLoading(false); }
  };

  useEffect(() => {
    hrApi.publicDepartments().then((r: any) => {
      const deps = Array.isArray(r?.data?.departments) ? r.data.departments : Array.isArray(r?.data?.items) ? r.data.items : [];
      setDepartments(deps);
    }).catch(() => setDepartments([]));
  }, []);

  useEffect(() => { fetchOpenings(); }, [search, deptFilter]);

  const applyFor = (job: any) => navigate(`/careers/apply?job=${job.id}`);

  return (
    <div className="min-h-screen surface-app public-light flex flex-col">
      <nav className="surface-ink sticky top-0 z-40 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link to="/career" className="flex items-center gap-2">
            <Logo size={30} />
            <span className="font-bold text-lg text-white">EMC<span className="text-[#F28C28]">.</span> Careers</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/career" className="hidden sm:inline-flex px-3 py-2 rounded-lg text-sm font-medium text-white/80 hover:bg-white/10 transition-colors">
              Home
            </Link>
            <Link
              to="/careers/apply"
              className="px-4 py-2 rounded-lg bg-[#F28C28] text-white text-sm font-semibold hover:bg-orange-600 transition-colors whitespace-nowrap"
            >
              Apply Now
            </Link>
          </div>
        </div>
      </nav>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-end gap-4 mb-8">
          <div className="flex w-full md:w-auto">
            <input className="input w-full md:w-80" placeholder="Search jobs…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="select w-full md:w-64" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        <h2 className="text-2xl font-bold ink-body mb-6">
          Open Positions {!loading && <span className="text-base font-normal ink-soft">({openings.length})</span>}
        </h2>

        {loading ? (
          <div className="h-64 flex items-center justify-center ink-soft">Loading…</div>
        ) : openings.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="ink-soft mb-4">No openings match your filters.</p>
            <button className="btn-primary" onClick={() => { setSearch(""); setDeptFilter(""); }}>Clear Filters</button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {openings.map((o: any) => (
              <div key={o.id} className="card p-5 flex flex-col">
                <h3 className="font-bold ink-body mb-1 leading-snug">{o.title}</h3>
                <p className="text-sm ink-soft mb-3">{o.department?.name} · {o.location}</p>
                <div className="space-y-1 text-xs ink-soft mb-4">
                  <div>Positions: <span className="ink-body font-medium">{o.positions}</span></div>
                  <div>Experience: {o.minExperience}–{o.maxExperience} yrs</div>
                  <div>Deadline: {new Date(o.deadline).toLocaleDateString()}</div>
                </div>
                <div className="mt-auto flex gap-2">
                  <button className="flex-1 btn-primary" onClick={() => applyFor(o)}>
                    Apply Now
                  </button>
                  <Link
                    to={`/careers/jobs/${o.id}`}
                    className="px-4 py-2.5 rounded-lg border border-[#171717]/15 ink-body text-sm font-medium hover:bg-[#171717]/5 transition-colors"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="surface-ink text-white/60 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between gap-3 text-sm">
          <span className="font-semibold text-white">EMC. Talent Acquisition Portal</span>
          <span>© {new Date().getFullYear()} Ecometrics Consultant Pvt. Ltd.</span>
        </div>
      </footer>
    </div>
  );
}
