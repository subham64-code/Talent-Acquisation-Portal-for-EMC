import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness, FilterX, GraduationCap, Heart, Mail, MapPin, Phone, Search, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { hrApi } from "../../lib/api";
import Logo from "../../components/Logo";

export default function Jobs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [openings, setOpenings] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [departmentId, setDepartmentId] = useState(() => searchParams.get("department") || "");
  const [sort, setSort] = useState<"newest" | "oldest" | "title" | "deadline">(() => (searchParams.get("sort") as any) || "newest");
  const [loading, setLoading] = useState(true);

  const fetchOpenings = async () => {
    setLoading(true);
    try {
      const response = await hrApi.publicOpenings({ page: 1, pageSize: 100, search: search.trim() || undefined, departmentId: departmentId || undefined });
      setOpenings(Array.isArray(response?.data?.items) ? response.data.items : []);
    } catch {
      setOpenings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    hrApi.publicDepartments().then((response: any) => {
      const payload = response?.data;
      setDepartments(Array.isArray(payload?.departments) ? payload.departments : Array.isArray(payload?.items) ? payload.items : []);
    }).catch(() => setDepartments([]));
  }, []);

  useEffect(() => { void fetchOpenings(); }, [search, departmentId]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (search.trim()) next.set("search", search.trim());
    if (departmentId) next.set("department", departmentId);
    if (sort !== "newest") next.set("sort", sort);
    setSearchParams(next, { replace: true });
  }, [search, departmentId, sort, setSearchParams]);

  const sortedOpenings = useMemo(() => {
    const next = [...openings];
    if (sort === "oldest") return next.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
    if (sort === "title") return next.sort((a, b) => String(a.title ?? "").localeCompare(String(b.title ?? "")));
    if (sort === "deadline") return next.sort((a, b) => new Date(a.deadline ?? "9999-12-31").getTime() - new Date(b.deadline ?? "9999-12-31").getTime());
    return next.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
  }, [openings, sort]);

  const clearFilters = () => {
    setSearch("");
    setDepartmentId("");
    setSort("newest");
  };

  const totalDepartments = departments.length;
  const totalPositions = openings.reduce((sum, opening) => sum + Number(opening.positions ?? 1), 0);

  return (
    <div className="corporate-site min-h-screen flex flex-col">
      <header className="corporate-header">
        <div className="corporate-header__inner">
          <Link to="/career" className="corporate-logo"><Logo size={46} /></Link>
          <nav className="corporate-nav" aria-label="Corporate navigation">
            <Link className="corporate-nav__link" to="/career">Home</Link>
            <Link className="corporate-nav__link" to="/career">About Us</Link>
            <Link className="corporate-nav__link" to="/career">Our Services</Link>
            <Link className="corporate-nav__link" to="/career">Delivery Experience</Link>
            <Link className="corporate-nav__link" to="/career">Our People</Link>
            <Link className="corporate-nav__link active" to="/career" aria-current="page">Careers</Link>
            <a className="corporate-nav__link" href="mailto:info@ecometrix.co.in">Contact</a>
          </nav>
          <div className="corporate-tools">
            <Link to="/auth/hr/login" className="corporate-tool">EMCOne</Link>
            <button className="corporate-tool" onClick={() => document.getElementById("job-search")?.focus()}><Search size={15} aria-hidden="true" /></button>
            <a className="corporate-connect" href="mailto:info@ecometrix.co.in">Let’s Connect <ArrowRight size={13} aria-hidden="true" /></a>
          </div>
        </div>
      </header>

      <section className="careers-hero" aria-labelledby="jobs-title">
        <div className="careers-hero__inner grid lg:grid-cols-[minmax(0,1fr)_360px] gap-8 items-end !py-8">
          <div>
            <div className="careers-breadcrumb"><Link to="/career">Home</Link><span>›</span><span>Careers</span></div>
            <span className="careers-kicker">Explore open positions</span>
            <h1 className="careers-title !text-[2.6rem] sm:!text-[4rem]" id="jobs-title">Find Your<br /><span>Place at Ecometrix</span></h1>
            <p className="careers-lead">Discover a career where engineering, planning and innovation create resilient cities and better public infrastructure.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[var(--emc-border)] bg-white p-5 shadow-sm"><strong className="block text-4xl font-black text-[var(--emc-green)]">{totalDepartments || "20+"}</strong><span className="text-xs text-[var(--emc-muted)] font-bold uppercase tracking-widest">Teams</span></div>
            <div className="rounded-2xl border border-[var(--emc-border)] bg-white p-5 shadow-sm"><strong className="block text-4xl font-black text-[var(--emc-green)]">{totalPositions}</strong><span className="text-xs text-[var(--emc-muted)] font-bold uppercase tracking-widest">Positions</span></div>
            <div className="rounded-2xl border border-[var(--emc-border)] bg-white p-5 shadow-sm lg:col-span-2"><Sparkles className="text-[var(--emc-green-dark)]" size={24} aria-hidden="true" /><strong className="block mt-2 text-sm">Jobs built for real-world impact</strong><small className="text-xs text-[var(--emc-muted)]">Every role supports infrastructure that improves daily life.</small></div>
          </div>
        </div>
      </section>

      <main className="flex-1 bg-white">
        <div className="section-container py-6">
          <div className="section-head">
            <div><div className="section-head__kicker">Open Positions</div><h2>Current Opportunities</h2></div>
            <p>Filter by keyword, department or deadline. Every role is sourced from EMC’s live hiring register.</p>
          </div>
          <div className="careers-layout">
            <section aria-labelledby="positions-title">
              <div className="flex flex-col md:flex-row md:items-center gap-2 mb-3">
                <label className="careers-search flex-1"><Search size={19} aria-hidden="true" /><input id="job-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search jobs, skills, departments…" aria-label="Search open positions" /></label>
                <label className="flex items-center gap-2 rounded-full border border-[var(--emc-border)] bg-white px-4 h-12 text-xs font-bold"><span className="text-[var(--emc-muted)]">Sort</span><select className="bg-transparent outline-none" value={sort} onChange={(event) => setSort(event.target.value as any)} aria-label="Sort positions"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option><option value="deadline">Deadline soon</option></select></label>
              </div>
              <div className="careers-chips" aria-label="Department filters"><button className={`careers-chip ${departmentId === "" ? "active" : ""}`} onClick={() => setDepartmentId("")}>All</button>{departments.slice(0, 10).map((department: any) => <button className={`careers-chip ${departmentId === department.id ? "active" : ""}`} key={department.id} onClick={() => setDepartmentId(department.id)}>{department.name}</button>)}{(search || departmentId || sort !== "newest") && <button className="careers-chip" onClick={clearFilters}><FilterX size={14} className="inline mr-1" aria-hidden="true" />Clear filters</button>}</div>
              <div className="flex items-center justify-between gap-3 mb-3"><span className="careers-count" aria-live="polite">{loading ? "Loading…" : `Showing ${sortedOpenings.length} role${sortedOpenings.length === 1 ? "" : "s"}`}</span><span className="text-xs font-bold text-[var(--emc-muted)]">Saved to this device</span></div>
              {loading ? <div className="why-card">Loading live open positions…</div> : sortedOpenings.length === 0 ? (
                <div className="why-card" aria-live="polite"><BriefcaseBusiness size={36} className="text-[var(--emc-green-dark)] mb-3" aria-hidden="true" /><h3 className="font-extrabold text-xl">No matching openings right now.</h3><p className="text-[var(--emc-muted)] mt-2">Try a broader keyword or clear your filters — new roles are added as projects are approved.</p><button className="careers-primary mt-5" onClick={clearFilters}>Clear filters</button></div>
              ) : (
                <div aria-live="polite">
                  {sortedOpenings.map((job) => (
                    <Link to={`/careers/jobs/${job.id}`} className="job-card" key={job.id} aria-label={`View openings for ${job.title}`}>
                      <span className="job-card__icon"><BriefcaseBusiness size={24} aria-hidden="true" /></span>
                      <span>
                        <span className="job-card__title">{job.title}</span>
                        <span className="job-card__meta"><MapPin size={12} className="inline" aria-hidden="true" /> {job.location || "Location updated on request"} · Posted {job.createdAt ? new Date(job.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "recently"}</span>
                        <span className="job-card__tags"><span className="job-card__tag">{job.department?.name || "Engineering"}</span><span className="job-card__tag">{job.employmentType?.name || "Full-time"}</span>{(job.requiredSkills ?? []).slice(0, 3).map((skill: string) => <span className="job-card__tag" key={skill}>{skill}</span>)}</span>
                      </span>
                      <span className="job-card__action">View Details</span>
                    </Link>
                  ))}
                </div>
              )}
              <div className="cv-cta"><span className="cv-cta__icon"><Mail size={22} aria-hidden="true" /></span><span><strong>Don’t see a suitable role?</strong><small>We’re always open to smart, curious engineers and planners.</small></span><a href="mailto:info@ecometrix.co.in?subject=CV%20for%20Future%20Opportunities">Send Your CV <ArrowRight size={13} aria-hidden="true" /></a></div>
            </section>

            <aside className="why-card" aria-label="Why work at Ecometrix">
              <span className="section-head__kicker">Why Ecometrix</span>
              <h3 className="mt-1">People. Projects. Purpose.</h3>
              <p>At Ecometrix, your work helps shape cleaner water, safer infrastructure, greener neighbourhoods and dignified urban services.</p>
              <div>{[{ icon: ShieldCheck, title: "Real Impact", text: "Contribute to projects that directly improve everyday life." },{ icon: UsersRound, title: "Learn by Doing", text: "Work directly with senior engineers, planners and project leads." },{ icon: Heart, title: "Collaborative Culture", text: "Respect, integrity, learning and delivery define how we work." }].map(({ icon: Icon, title, text }) => <div className="why-item" key={title}><span className="why-item__icon"><Icon size={20} aria-hidden="true" /></span><span><strong>{title}</strong><small>{text}</small></span></div>)}</div>
              <div className="mt-4 rounded-xl border border-[var(--emc-border)] bg-[var(--emc-bg-soft)] p-4"><span className="text-[10px] uppercase tracking-[.14em] font-black text-[var(--emc-green-dark)]">Career advice</span><p className="text-xs mt-1">Applications are reviewed for shortlisted roles. For fresher roles, mention your strongest project or internship experience in the skills section.</p></div>
            </aside>
          </div>
        </div>
      </main>

      <footer className="corporate-footer">
        <div className="footer-grid">
          <div className="footer-card"><Logo size={50} /><p className="footer-address"><MapPin size={17} aria-hidden="true" /><span>Unit 402, Mi Towers,<br />Pune, Maharashtra 411001</span></p><p className="footer-address"><Phone size={17} aria-hidden="true" /><span>+91 22 0000 0000</span></p><p className="footer-address"><Mail size={17} aria-hidden="true" /><span>info@ecometrix.co.in</span></p></div>
          <nav className="footer-nav" aria-label="Footer navigation"><Link to="/career">Home</Link><Link to="/career">About Us</Link><Link to="/career">Our Services</Link><Link to="/career">Delivery Experience</Link><Link to="/career">Our People</Link><Link to="/careers/jobs">Careers</Link><a href="mailto:info@ecometrix.co.in">Contact</a><Link to="/auth/hr/login">EMCOne</Link></nav>
          <div className="subscribe"><h3>Career updates</h3><p>Write to our recruitment team to stay informed about suitable openings.</p><a className="btn" href="mailto:info@ecometrix.co.in?subject=Career%20updates">Request updates <Mail size={15} aria-hidden="true" /></a></div>
        </div>
        <div className="footer-divider"><span className="text-xs text-[#7c879d]">© {new Date().getFullYear()} Ecometrix Consultants Private Limited.</span></div>
      </footer>
    </div>
  );
}
