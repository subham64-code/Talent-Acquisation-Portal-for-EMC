import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { hrApi } from "../../lib/api";
import Logo from "../../components/Logo";

export default function Home() {
  const [openings, setOpenings] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      hrApi.publicOpenings({ pageSize: 6 }).then((r: any) => {
        setOpenings(Array.isArray(r?.data?.items) ? r.data.items : []);
      }).catch(() => setOpenings([])),
      hrApi.publicDepartments().then((r: any) => {
        const deps = Array.isArray(r?.data?.departments) ? r.data.departments : Array.isArray(r?.data?.items) ? r.data.items : [];
        setDepartments(deps);
      }).catch(() => setDepartments([])),
    ]).finally(() => setLoading(false));
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div ref={topRef} className="min-h-screen surface-app public-light ink-body flex flex-col">
      {/* WELCOME ANNOUNCEMENT — floating marquee */}
      <div className="announcement-bar bg-gradient-to-r from-[#38570A] via-[#4C730D] to-[#38570A] text-white text-[11px] sm:text-xs font-semibold tracking-wide py-1.5 border-b border-white/10 overflow-hidden select-none" role="status" aria-live="polite">
        <div className="announcement-track">
          {[0, 1].map((n) => (
            <span key={n} className="pr-16">
              <span className="text-[#8BC34A]">★</span> Welcome to Ecometrics Consultant Pvt. Ltd. – Talent Acquisition Portal <span className="text-[#FF9412]">•</span>&nbsp;&nbsp;
              Explore careers in GIS, Civil, Water, Telecom, R&amp;D and more <span className="text-[#FF9412]">•</span>&nbsp;&nbsp;
              <span className="text-[#8BC34A]">★</span> Welcome to Ecometrics Consultant Pvt. Ltd. – Talent Acquisition Portal <span className="text-[#FF9412]">•</span>&nbsp;&nbsp;
              Explore careers in GIS, Civil, Water, Telecom, R&amp;D and more <span className="text-[#FF9412]">•</span>&nbsp;&nbsp;
            </span>
          ))}
        </div>
      </div>

      {/* NAVBAR */}
      <nav className="surface-ink sticky top-0 z-40 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/career" className="flex items-center gap-2 shrink-0">
              <Logo size={28}  onDark />
              <span className="hidden min-[400px]:inline font-bold text-base sm:text-xl text-white tracking-tight">
                EMC<span className="text-[#FF9412]">.</span> Talent
              </span>
            </Link>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                to="/careers/apply"
                className="px-3.5 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-[#FF9412] text-white text-xs sm:text-sm font-extrabold tracking-wide hover:bg-orange-600 transition-colors whitespace-nowrap shadow-[0_4px_14px_rgba(255,148,18,.4)]"
              >
                APPLY NOW
              </Link>
              <Link
                to="/auth/hr/login"
                className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-white/25 text-white text-xs sm:text-sm font-semibold hover:bg-white/10 transition-colors whitespace-nowrap"
              >
                HR Login
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section id="top" className="surface-ink text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-[#FF9412] mb-4">
                <span className="w-6 h-[3px] bg-[#FF9412] inline-block" /> Talent Acquisition
              </span>
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-5">
                Careers at <span className="text-[#8BC34A]">EMC</span>
              </h1>
              <p className="text-[#C9D1CC] text-base sm:text-lg leading-relaxed mb-8 max-w-xl">
                Join Ecometrics Consultant Pvt. Ltd. and help shape tomorrow&apos;s infrastructure through
                planning, design, GIS, water, telecom and project management expertise.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => scrollTo("positions")}
                  className="px-6 py-3 rounded-lg bg-[#FF9412] text-white font-semibold text-sm hover:bg-orange-600 transition-colors"
                >
                  Open Positions
                </button>
                <button
                  onClick={() => navigate("/careers/apply")}
                  className="px-6 py-3 rounded-lg bg-[#659616] text-white font-semibold text-sm hover:bg-[#4C730D] transition-colors"
                >
                  Apply Now
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Departments", value: departments.length },
                { label: "Open Positions", value: openings.length },
                { label: "Years of Excellence", value: "15+" },
                { label: "Projects Delivered", value: "400+" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
                  <p className="text-2xl sm:text-3xl font-extrabold text-[#8BC34A]">{s.value}</p>
                  <p className="text-xs uppercase tracking-wider text-[#C9D1CC] mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* OPEN POSITIONS */}
      <section id="positions" className="py-14 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold ink-body mb-1">Open Positions</h2>
              <p className="ink-soft text-sm">
                {loading ? "Loading current openings…" : `${openings.length} active opportunities across EMC.`}
              </p>
            </div>
            <button
              onClick={() => navigate("/careers/jobs")}
              className="px-5 py-2.5 rounded-lg border border-[#659616]/40 text-[#659616] font-semibold text-sm hover:bg-[#659616]/10 transition-colors self-start"
            >
              View all jobs →
            </button>
          </div>

          {loading ? (
            <div className="h-64 flex items-center justify-center ink-soft">Loading openings…</div>
          ) : openings.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="ink-soft mb-4">No open positions at the moment.</p>
              <button onClick={() => navigate("/careers/jobs")} className="btn-primary">Browse Careers</button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {openings.map((o: any) => (
                <div key={o.id} className="card p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-bold ink-body leading-snug">{o.title}</h3>
                    <span className="shrink-0 badge border-[#659616]/30 bg-[#659616]/10 text-[#659616]/80">
                      {o.positions} open
                    </span>
                  </div>
                  <p className="text-xs ink-soft mb-3">
                    {o.department?.name} · {o.location}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {(o.requiredSkills || []).slice(0, 3).map((s: string) => (
                      <span key={s} className="text-[10px] px-2 py-0.5 rounded bg-[#FF9412]/10 text-[#FF9412] font-semibold">{s}</span>
                    ))}
                  </div>
                  <div className="mt-auto flex gap-2">
                    <Link to={`/careers/jobs/${o.id}`} className="flex-1 btn-primary text-center">View & Apply</Link>
                    <Link
                      to="/careers/jobs"
                      className="px-4 py-2.5 rounded-lg border border-[#171717]/15 ink-body text-sm font-medium hover:bg-[#171717]/5 transition-colors"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="py-14 sm:py-20 bg-[#171717] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Logo size={34}  onDark />
              <span className="text-xl font-bold text-white">EMC<span className="text-[#FF9412]">.</span></span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">About EMC</h2>
            <p className="text-[#C9D1CC] leading-relaxed mb-5">
              Ecometrics Consultant Pvt. Ltd. (EMC) is a multi-disciplinary engineering consultancy
              delivering planning, design, and project management services across urban infrastructure,
              water supply, GIS, telecom, drainage and transportation.
            </p>
            <p className="text-[#C9D1CC] leading-relaxed mb-7">
              Our Talent Acquisition Portal centralises the complete employee and recruitment lifecycle —
              from CV databank and vacancy management through AI-assisted screening, interviews, offers
              and document verification — so every decision is traceable and every record is secure.
            </p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => scrollTo("positions")} className="px-6 py-3 rounded-lg bg-[#FF9412] text-white font-semibold text-sm hover:bg-orange-600 transition-colors">
                Explore Careers
              </button>
              <button onClick={() => scrollTo("contact")} className="px-6 py-3 rounded-lg border border-white/25 text-white font-semibold text-sm hover:bg-white/10 transition-colors">
                Contact Us
              </button>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { t: "Unlocking Transformation", d: "Our tagline — turning data into infrastructure decisions." },
              { t: "Centralised CV Databank", d: "Employees, alumni and candidates in one searchable repository." },
              { t: "Explainable AI Screening", d: "Transparent, weighted scoring that HR can review and override." },
              { t: "Secure Document Workflow", d: "Role-based access, audit trails and expiring secure links." },
            ].map((f) => (
              <div key={f.t} className="rounded-xl border border-white/10 bg-white/5 p-5">
                <h3 className="font-semibold text-[#8BC34A] mb-1.5 text-sm">{f.t}</h3>
                <p className="text-[#C9D1CC] text-xs leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DEPARTMENTS */}
      <section id="departments" className="py-14 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold ink-body mb-2">Our Departments</h2>
          <p className="ink-soft text-sm mb-8">Specialist teams working across every project discipline.</p>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {departments.map((d: any) => (
              <div key={d.id} className="rounded-lg border border-[#171717]/10 surface-card px-4 py-3 text-sm font-medium ink-body hover:border-[#659616]/50 transition-colors">
                {d.name}
              </div>
            ))}
            {departments.length === 0 && (
              <div className="col-span-full rounded-lg border border-dashed border-[#171717]/15 px-4 py-8 text-center ink-soft text-sm">
                Departments will appear here once they are set up by EMC HR.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="py-14 sm:py-20 bg-[#659616] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8">Contact EMC</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { l: "HR Email", v: "subhambehera2023@gift.edu.in" },
              { l: "Phone", v: "+91 22 0000 0000" },
              { l: "Office", v: "Pune, Maharashtra, India" },
              { l: "Working Hours", v: "Mon–Fri, 9:30 AM – 6:30 PM IST" },
            ].map((c) => (
              <div key={c.l} className="rounded-xl bg-white/10 border border-white/15 p-5">
                <p className="text-xs uppercase tracking-wider text-white/70 mb-1.5">{c.l}</p>
                <p className="font-semibold text-sm break-words">{c.v}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/careers/apply" className="px-6 py-3 rounded-lg bg-[#FF9412] text-white font-semibold text-sm hover:bg-orange-600 transition-colors">
              Apply for a Job
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="surface-ink text-[#C9D1CC] py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Logo size={26}  onDark />
            <span className="font-bold text-white">EMC<span className="text-[#FF9412]">.</span> Talent Acquisition Portal</span>
          </div>
          <div className="flex flex-wrap gap-5">
            <Link to="/career" className="hover:text-white">Careers</Link>
            <Link to="/careers/jobs" className="hover:text-white">Jobs</Link>
            <Link to="/careers/apply" className="hover:text-white">Apply Now</Link>
            <Link to="/auth/hr/login" className="hover:text-white">HR Portal</Link>
          </div>
          <p className="text-xs text-white/40">© {new Date().getFullYear()} Ecometrics Consultant Pvt. Ltd.</p>
        </div>
      </footer>
    </div>
  );
}
