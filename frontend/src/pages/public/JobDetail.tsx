import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness, Check, GraduationCap, Heart, MapPin, Share2 } from "lucide-react";
import Logo from "../../components/Logo";
import { hrApi } from "../../lib/api";

export default function JobDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [opening, setOpening] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    hrApi.publicOpening(id!).then((response: any) => setOpening(response?.data?.item ?? null)).catch(() => setOpening(null)).finally(() => setLoading(false));
  }, [id]);

  const shareLink = useMemo(() => `${window.location.origin}/careers/jobs/${id}`, [id]);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {}
  };
  const applied = searchParams.get("applied") === "1";

  if (loading) return <div className="min-h-screen flex items-center justify-center surface-app public-light ink-soft">Loading role…</div>;
  if (!opening) return (
    <div className="min-h-screen flex items-center justify-center surface-app public-light p-4"><div className="card p-8 text-center max-w-md"><BriefcaseBusiness className="mx-auto mb-4 text-[#659616]" size={36} /><h1 className="text-xl font-bold ink-body">This opening is no longer available.</h1><p className="ink-soft mt-2">Explore our current roles or send your CV for future openings.</p><Link to="/careers/jobs" className="btn-primary mt-6 inline-flex">Browse all jobs</Link></div></div>
  );

  const responsibilities = opening.responsibilities ? String(opening.responsibilities).split(/\n|;/).map((item: string) => item.trim()).filter(Boolean) : [];

  return (
    <div className="min-h-screen surface-app public-light">
      <nav className="corporate-header" aria-label="Ecometrix careers"><div className="corporate-header__inner"><Link to="/career" className="corporate-logo"><Logo size={46} /></Link><nav className="corporate-nav" aria-label="Career sections"><Link className="corporate-nav__link" to="/career">Home</Link><Link className="corporate-nav__link" to="/career">About Us</Link><Link className="corporate-nav__link" to="/career">Our Services</Link><Link className="corporate-nav__link" to="/career">Delivery Experience</Link><Link className="corporate-nav__link" to="/career">Our People</Link><Link className="corporate-nav__link active" to="/career" aria-current="page">Careers</Link><a className="corporate-nav__link" href="mailto:info@ecometrix.co.in">Contact</a></nav><div className="corporate-tools"><button type="button" onClick={() => void copyLink()} className="corporate-tool">{copied ? <Check size={15} /> : <Share2 size={15} />}{copied ? "Copied" : "Share"}</button><Link to="/careers/jobs" className="corporate-connect">All roles <ArrowRight size={13} /></Link></div></div></nav>

      <section className="job-detail-hero"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"><div className="careers-breadcrumb text-[#6f7b98]"><Link to="/career">Home</Link><span>›</span><Link to="/careers/jobs">Open positions</Link><span>›</span><span>{opening.title}</span></div><span className="careers-kicker">{opening.department?.name || "EMC Careers"}</span><h1 className="careers-title !text-[2.4rem] sm:!text-[3.6rem]">{opening.title}</h1><div className="flex flex-wrap gap-2 mt-4"><span className="job-detail-tag job-detail-tag--open">{opening.status === "PUBLISHED" ? "Open" : opening.status}</span><span className="job-detail-tag">{opening.positions ?? 1} position{Number(opening.positions ?? 1) === 1 ? "" : "s"}</span>{opening.location && <span className="job-detail-tag"><MapPin size={13} aria-hidden="true" />{opening.location}</span>}<span className="job-detail-tag">{opening.employmentType?.name || "Full-time"}</span>{opening.deadline && <span className="job-detail-tag job-detail-tag--deadline">Apply by {new Date(opening.deadline).toLocaleDateString()}</span>}</div></div></section>

      <main className="flex-1 py-8"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
        <article className="card p-6 sm:p-8">
          {applied && <div className="rounded-xl border border-[#659616]/30 bg-[#659616]/10 p-4 mb-6"><strong className="text-[#4c730d]">Application submitted successfully</strong><p className="text-sm ink-soft mt-1">A confirmation email has been sent to your inbox with your Application ID.</p></div>}
          <section><h2 className="font-extrabold ink-body text-lg">Role Overview</h2><div className="ink-soft whitespace-pre-line text-sm leading-relaxed mt-2">{opening.description}</div></section>
          {responsibilities.length > 0 && <section className="border-t border-[#171717]/10 pt-6 mt-6"><h2 className="font-extrabold ink-body text-lg">Key Responsibilities</h2><ul className="mt-3 space-y-2 text-sm ink-soft">{responsibilities.slice(0, 10).map((item: string, index: number) => <li key={index} className="flex gap-2"><span className="text-[#659616] font-black">✓</span><span>{item}</span></li>)}</ul></section>}
          <section className="border-t border-[#171717]/10 pt-6 mt-6"><h2 className="font-extrabold ink-body text-lg">Qualifications & Requirements</h2><div className="grid sm:grid-cols-2 gap-3 mt-3">{[{label:"Qualification",value:opening.requiredQualification || "Relevant qualification"},{label:"Experience",value:`${opening.minExperience ?? 0}–${opening.maxExperience ?? "—"} years`},{label:"Relevant experience",value:opening.relevantExperience ? `${opening.relevantExperience} years` : "Required"},{label:"Deadline",value:opening.deadline ? new Date(opening.deadline).toLocaleDateString() : "Open"},{label:"Required skills",value:(opening.requiredSkills ?? []).length ? opening.requiredSkills.join(", ") : "Relevant skills"},{label:"Preferred skills",value:(opening.preferredSkills ?? []).length ? opening.preferredSkills.join(", ") : "None specified"}].map((item) => <div key={item.label} className="rounded-xl border border-[#e1e9d7] bg-[#f7faf2] p-3"><span className="text-[10px] uppercase tracking-wider ink-soft font-bold">{item.label}</span><span className="block text-sm ink-body mt-1">{item.value}</span></div>)}</div>{opening.program?.name && <div className="mt-4 rounded-xl border border-[#ffd99e] bg-[#fff8eb] p-4"><span className="text-[10px] uppercase tracking-wider text-[#b15a10] font-bold">Programme / Project</span><strong className="block ink-body mt-1">{opening.program.name}</strong></div>}</section>
          <div className="flex flex-col sm:flex-row gap-3 mt-6"><button className="btn btn--primary btn--lg flex-1" onClick={() => navigate(`/careers/apply?job=${opening.id}`)} disabled={applied}>{applied ? "Application submitted" : "Apply for this position"}{!applied && <ArrowRight size={17} aria-hidden="true" />}</button><button type="button" className="btn btn--outline" onClick={() => void copyLink()}>{copied ? "Copied link" : "Copy role link"}</button></div>
        </article>
        <aside className="career-sidebar h-fit"><span className="career-section-kicker">Why join EMC?</span><h3 className="text-2xl font-extrabold ink-body mt-2">Build meaningful infrastructure.</h3><p className="ink-soft text-sm leading-relaxed mt-2">Join a multidisciplinary team shaping safer roads, cleaner water, resilient cities and better public services.</p><div className="mt-5"><div className="career-why-item"><span className="career-why-item__icon"><BriefcaseBusiness size={20} /></span><span><strong>Impactful projects</strong><p>Work that directly improves communities across India.</p></span></div><div className="career-why-item"><span className="career-why-item__icon"><GraduationCap size={20} /></span><span><strong>Continuous learning</strong><p>Development through mentorship and multidisciplinary exposure.</p></span></div><div className="career-why-item"><span className="career-why-item__icon"><Heart size={20} /></span><span><strong>Grow with balance</strong><p>A people-first culture with strong ethics and autonomy.</p></span></div></div><div className="rounded-xl bg-white border border-[#dbe8c9] p-4 mt-5"><span className="text-[10px] uppercase tracking-[.14em] font-bold text-[#4c730d]">Application note</span><p className="text-xs ink-soft mt-1">Your current profile and CV will not be used for any purpose other than this recruitment process.</p></div></aside></div></main>
      <footer className="surface-ink text-white/55 py-6 mt-auto"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between gap-2 text-xs"><span>EMC. Careers</span><span>© {new Date().getFullYear()} Ecometrics Consultant Pvt. Ltd.</span></div></footer>
    </div>
  );
}
