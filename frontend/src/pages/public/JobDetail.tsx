import { useState, useEffect } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { hrApi } from "../../lib/api";
import Logo from "../../components/Logo";

export default function JobDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [opening, setOpening] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hrApi.publicOpening(id!).then((r: any) => { setOpening(r?.data?.item ?? null); }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const applyFor = () => {
    if (!opening) return;
    navigate(`/careers/apply?job=${opening.id}`);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center surface-app public-light ink-soft">Loading…</div>
  );
  if (!opening) return (
    <div className="min-h-screen flex items-center justify-center surface-app public-light">
      <div className="card p-8 text-center">
        <p className="ink-soft mb-4">This opening is no longer available.</p>
        <Link to="/careers/jobs" className="btn-primary">Browse all jobs</Link>
      </div>
    </div>
  );

  const applied = searchParams.get("applied") === "1";

  return (
    <div className="min-h-screen surface-app public-light flex flex-col">
      <nav className="surface-ink sticky top-0 z-40 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link to="/careers/jobs" className="flex items-center gap-2">
            <Logo size={30}  onDark />
            <span className="font-bold text-lg text-white">EMC<span className="text-[#FF9412]">.</span> Careers</span>
          </Link>
          <Link to="/careers/jobs" className="px-4 py-2 rounded-lg border border-white/25 text-white text-sm font-medium hover:bg-white/10 transition-colors">
            ← All Jobs
          </Link>
        </div>
      </nav>

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {applied && (
          <div className="rounded-xl border border-[#659616]/40 bg-[#659616]/10 p-4 mb-5">
            <p className="font-semibold text-[#659616] mb-1">Application submitted successfully</p>
            <p className="text-sm ink-soft">A confirmation email has been sent to your inbox with your application ID.</p>
          </div>
        )}

        <div className="card p-6">
          <h1 className="text-2xl font-bold ink-body mb-3">{opening.title}</h1>
          <div className="flex flex-wrap gap-2 text-xs mb-6">
            <span className="badge border-[#659616]/30 bg-[#659616]/20 text-[#659616]/80">
              {opening.status === "PUBLISHED" ? "Open" : opening.status}
            </span>
            <span className="badge border-[#171717]/20 bg-[#171717]/5 ink-body">{opening.department?.name}</span>
            <span className="badge border-[#171717]/20 bg-[#171717]/5 ink-body">{opening.positions} position(s)</span>
            <span className="badge border-[#171717]/20 bg-[#171717]/5 ink-body">{opening.location}</span>
            <span className="badge border-[#FF9412]/30 bg-[#FF9412]/10 text-[#FF9412]/80">{opening.employmentType?.name || "Full-Time"}</span>
            {opening.program?.name && <span className="badge border-[#171717]/20 bg-[#171717]/5 ink-body">{opening.program.name}</span>}
          </div>

          <div className="border-t border-[#171717]/10 pt-5 mb-5">
            <h2 className="font-semibold ink-body mb-2">Job Description</h2>
            <div className="ink-soft whitespace-pre-line text-sm leading-relaxed">{opening.description}</div>
          </div>

          {opening.responsibilities && (
            <div className="border-t border-[#171717]/10 pt-5 mb-5">
              <h2 className="font-semibold ink-body mb-2">Roles & Responsibilities</h2>
              <div className="ink-soft whitespace-pre-line text-sm leading-relaxed">{opening.responsibilities}</div>
            </div>
          )}

          <div className="border-t border-[#171717]/10 pt-5 mb-6">
            <h2 className="font-semibold ink-body mb-3">Requirements</h2>
            <ul className="list-disc list-inside ink-soft space-y-1.5 text-sm">
              <li>Qualification: {opening.requiredQualification}</li>
              <li>Experience: {opening.minExperience}–{opening.maxExperience} years</li>
              <li>Relevant experience: {opening.relevantExperience} years</li>
              <li>Required skills: {(opening.requiredSkills || []).join(", ") || "—"}</li>
              <li>Preferred skills: {(opening.preferredSkills || []).join(", ") || "—"}</li>
              <li>Application deadline: {new Date(opening.deadline).toLocaleDateString()}</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={applyFor} className="flex-1 btn-primary py-3" disabled={applied}>
              {applied ? "Application Submitted" : "Apply Now"}
            </button>
            <Link to="/careers/jobs" className="px-6 py-3 rounded-lg border border-[#171717]/15 ink-body text-sm font-medium hover:bg-[#171717]/5 transition-colors text-center">
              View other jobs
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
