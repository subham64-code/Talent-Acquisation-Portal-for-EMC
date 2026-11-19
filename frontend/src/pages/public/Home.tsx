import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness, ChevronDown, Heart, Leaf, Mail, MapPin, Phone, Search, Send, ShieldCheck, UsersRound } from "lucide-react";
import Logo from "../../components/Logo";
import { hrApi } from "../../lib/api";

export default function Home() {
  const navigate = useNavigate();
  const [openings, setOpenings] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [backTopVisible, setBackTopVisible] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);


  useEffect(() => {
    Promise.allSettled([
      hrApi.publicOpenings({ pageSize: 12 }),
      hrApi.publicDepartments(),
    ]).then(([jobsResult, departmentsResult]) => {
      const jobsPayload = jobsResult.status === "fulfilled" ? jobsResult.value?.data : null;
      const departmentPayload = departmentsResult.status === "fulfilled" ? departmentsResult.value?.data : null;
      setOpenings(Array.isArray(jobsPayload?.items) ? jobsPayload.items : []);
      const nextDepartments = Array.isArray(departmentPayload?.departments) ? departmentPayload.departments : Array.isArray(departmentPayload?.items) ? departmentPayload.items : [];
      setDepartments(nextDepartments);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onScroll = () => setBackTopVisible(window.scrollY > 250);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const filteredOpenings = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return openings.filter((job) => {
      const matchesDepartment = !departmentId || (job.departmentId ?? job.department?.id) === departmentId;
      const matchesSearch = !needle || [job.title, job.department?.name, job.location, job.status, ...(job.requiredSkills ?? [])]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(needle));
      return matchesDepartment && matchesSearch;
    });
  }, [openings, search, departmentId]);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="corporate-site min-h-screen">
      <header className="corporate-header">
        <div className="corporate-header__inner">
          <Link to="/career" className="corporate-logo" aria-label="Ecometrix home"><Logo size={46} /></Link>
          <nav className="corporate-nav" aria-label="Corporate navigation">
            <a className="corporate-nav__link" href="#positions">Home</a>
            <a className="corporate-nav__link" href="#voices">About Us</a>
            <a className="corporate-nav__link" href="#voices">Our Services</a>
            <a className="corporate-nav__link" href="#voices">Delivery Experience</a>
            <a className="corporate-nav__link" href="#voices">Our People <ChevronDown size={13} aria-hidden="true" /></a>
            <a className="corporate-nav__link active" href="#positions" aria-current="page">Careers</a>
            <a className="corporate-nav__link" href="mailto:info@ecometrix.co.in">Contact</a>
          </nav>
          <div className="corporate-tools" aria-label="Corporate tools">
            <Link to="/auth/hr/login" className="corporate-tool">EMCOne</Link>
            <button type="button" className="corporate-tool" onClick={() => navigate("/careers/jobs")} aria-label="Open jobs search"><Search size={15} aria-hidden="true" /></button>
            <a className="corporate-connect" href="mailto:info@ecometrix.co.in">Let’s Connect <ArrowRight size={13} aria-hidden="true" /></a>
          </div>
        </div>
      </header>

      <section className="careers-hero" aria-labelledby="careers-title">
        <div className="careers-hero__inner">
          <div className="careers-kicker">Careers at Ecometrix</div>
          <h1 className="careers-title" id="careers-title">Build Your Career for a <span>Better Tomorrow</span></h1>
          <p className="careers-lead">Join a team that’s shaping resilient cities, sustainable infrastructure and a healthier planet.</p>
          <div className="careers-actions">
            <button type="button" className="careers-primary" onClick={() => scrollTo("positions")}>Explore Opportunities <ArrowRight size={16} aria-hidden="true" /></button>
            <button type="button" className="careers-secondary" onClick={() => scrollTo("voices")}>Life at Ecometrix</button>
          </div>
        </div>
      </section>

      <main id="positions" className="openings-section">
        <div className="section-container">
          <div className="section-head">
            <div><div className="section-head__kicker">Open Positions</div><h2>Current Opportunities</h2></div>
            <p>Explore exciting career opportunities across engineering, planning, environment, GIS, digital solutions and more.</p>
          </div>
          <div className="careers-layout">
            <div>
              <div className="careers-search-row">
                <label className="careers-search"><Search size={19} aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search jobs, skills, departments..." aria-label="Search open positions" /></label>
                <span className="careers-count" aria-live="polite">{loading ? "Loading…" : `Showing ${filteredOpenings.length} roles`}</span>
              </div>
              <div className="careers-chips" aria-label="Department filters">
                <button className={`careers-chip ${departmentId === "" ? "active" : ""}`} onClick={() => setDepartmentId("")}>All</button>
                {departments.slice(0, 8).map((department: any) => <button className={`careers-chip ${departmentId === department.id ? "active" : ""}`} key={department.id} onClick={() => setDepartmentId(department.id)}>{department.name}</button>)}
              </div>
              {loading ? <div className="why-card">Loading current opportunities…</div> : filteredOpenings.length === 0 ? (
                <div className="why-card" aria-live="polite"><h3 className="text-lg font-bold text-[#111a30]">No open positions matching your filter.</h3><p>Try another search term or department, or send your CV directly to our recruitment team.</p><button className="careers-primary mt-4" onClick={() => { setSearch(""); setDepartmentId(""); }}>Clear filters</button></div>
              ) : (
                <div aria-live="polite">
                  {filteredOpenings.map((job) => (
                    <Link to={`/careers/jobs/${job.id}`} className="job-card" key={job.id} aria-label={`View details for ${job.title}`}>
                      <span className="job-card__icon"><BriefcaseBusiness size={24} aria-hidden="true" /></span>
                      <span>
                        <span className="job-card__title">{job.title}</span>
                        <span className="job-card__meta"><MapPin size={12} className="inline" aria-hidden="true" /> {job.location || "Location update on request"} · Posted {job.createdAt ? new Date(job.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "recently"}</span>
                        <span className="job-card__tags"><span className="job-card__tag">{job.department?.name || "Engineering"}</span><span className="job-card__tag">{job.employmentType?.name || "Full-time"}</span>{(job.requiredSkills ?? []).slice(0, 2).map((skill: string) => <span key={skill} className="job-card__tag">{skill}</span>)}</span>
                      </span>
                      <span className="job-card__action">View Details</span>
                    </Link>
                  ))}
                </div>
              )}
              <div className="cv-cta"><span className="cv-cta__icon"><Mail size={22} aria-hidden="true" /></span><span><strong>Don’t see a suitable role?</strong><small>We’re always open to talented individuals. Share your CV with us.</small></span><a href="mailto:info@ecometrix.co.in?subject=CV%20for%20Expression%20of%20Interest">Send Your CV <ArrowRight size={13} aria-hidden="true" /></a></div>
            </div>
            <aside className="why-card" aria-label="Why join Ecometrix">
              <h3>Why Join Ecometrix?</h3>
              <p>At Ecometrix, you’ll work on diverse projects that create lasting impact — from water and environment to smart cities and digital innovation.</p>
              <div>{[{ icon: ShieldCheck, title: "Impactful Projects", text: "Solve real challenges that shape cities and communities." },{ icon: UsersRound, title: "Learning & Development", text: "Grow with cross-functional mentors and structured exposure." },{ icon: Leaf, title: "Collaborative Team", text: "Engineers, planners, analysts and designers working together." },{ icon: Heart, title: "Employee Wellbeing", text: "A people-first culture built around respect and balance." }].map(({ icon: Icon, title, text }) => <div className="why-item" key={title}><span className="why-item__icon"><Icon size={21} aria-hidden="true" /></span><span><strong>{title}</strong><small>{text}</small></span></div>)}</div>
            </aside>
          </div>
        </div>
      </main>

      <section id="voices" className="voices">
        <div className="section-container">
          <div className="voices__box">
            <div className="voices__text">
              <div className="section-head__kicker">Our People, Our Strength</div>
              <h2 className="section-head h2 text-3xl font-bold text-[#111a30] mt-2">Voices from Our Team</h2>
              <p className="voices__quote">“Every day at Ecometrix is different. We don’t just deliver projects; we create lasting impact for people and the planet.”</p>
              <div className="voices__person"><span className="voices__avatar">ET</span><span><span className="voices__name">Ecometrix Team Member</span><span className="block voices__role">Project Delivery</span></span></div>
            </div>
            <div className="voices__block"><strong>Great People.</strong><span>Greater Impact.</span></div>
          </div>
        </div>
      </section>

      <footer className="corporate-footer">
        <div className="footer-grid">
          <div className="footer-card">
            <Logo size={52} />
            <p className="footer-address"><MapPin size={17} aria-hidden="true" /><span>Unit 402, Mi Towers,<br />Pune, Maharashtra 411001</span></p>
            <p className="footer-address"><Phone size={17} aria-hidden="true" /><span>+91 22 0000 0000</span></p>
            <p className="footer-address"><Mail size={17} aria-hidden="true" /><span>info@ecometrix.co.in</span></p>
          </div>
          <nav className="footer-nav" aria-label="Footer navigation">
            <a href="#positions">Home</a><a href="#voices">About Us</a><a href="#voices">Our Services</a><a href="#voices">Delivery Experience</a><a href="#voices">Our People</a><a href="#positions">Careers</a><a href="mailto:info@ecometrix.co.in">Contact</a><Link to="/auth/hr/login">EMCOne</Link>
          </nav>
          <div className="subscribe"><h3>Career updates</h3><p>Write to our recruitment team to stay informed about suitable openings.</p><a className="btn" href="mailto:info@ecometrix.co.in?subject=Career%20updates">Request updates <Send size={15} aria-hidden="true" /></a></div>
        </div>
        <div className="footer-divider"><span className="text-xs text-[#7c879d]">© {new Date().getFullYear()} Ecometrix Consultants Private Limited.</span></div>
      </footer>

      <button type="button" className="quick-help" onClick={() => setHelpOpen((current) => !current)} aria-expanded={helpOpen} aria-label="Quick help">Quick Help <span aria-hidden="true">ϟ</span></button>
      {helpOpen && <div className="chatbot-fab" style={{ bottom: "150px" }} role="dialog" aria-label="Quick help"><span className="status-dot" aria-hidden="true" /><small>Quick help</small><span>Need assistance with your application? Contact HR.</span></div>}
      <button type="button" className="chatbot-fab" onClick={() => setChatOpen((current) => !current)} aria-expanded={chatOpen} aria-label="Open support chat"><span className="status-dot" aria-hidden="true" /><small>Need help? We’re here</small><span>{chatOpen ? "Close support" : "Hi there! 👋"}</span></button>
      {chatOpen && <div className="chatbot-fab" style={{ bottom: "82px" }} role="status"><span className="status-dot" aria-hidden="true" /><small>Support</small><span>HR team: info@ecometrix.co.in</span></div>}
      {backTopVisible && <button type="button" className="back-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top">↑</button>}
    </div>
  );
}
