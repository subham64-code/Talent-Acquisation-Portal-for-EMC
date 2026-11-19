import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Mail,
  Search,
  Settings,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

const MODULES = [
  {
    id: "openings",
    step: "01",
    title: "Openings and vacancy management",
    summary: "Create, review, publish and close approved hiring plans from one place.",
    icon: BriefcaseBusiness,
    to: "/hr/manage-openings",
    toLabel: "Open vacancy register",
    tasks: [
      "Confirm title, department, designation, CTC, joining date and position count before publishing.",
      "Use a clean job code and meaningful required skills so candidates match accurately.",
      "Close expired openings to keep reports and career visibility accurate.",
    ],
  },
  {
    id: "screening",
    step: "02",
    title: "CV screening and shortlisting",
    summary: "Review every application in one pipeline, run AI scoring and take structured decisions.",
    icon: ClipboardList,
    to: "/hr/ai-screening",
    toLabel: "Open CV screening",
    tasks: [
      "Review all applications, AI match score and missing skills before deciding.",
      "Move qualified candidates to shortlisted, hold or reject based on recorded reasons.",
      "Use HR remarks consistently — these remarks travel through approval and offers.",
    ],
  },
  {
    id: "interviews",
    step: "03",
    title: "Interviews and feedback",
    summary: "Schedule rounds, invite interviewers and collect consistent structured feedback.",
    icon: UsersRound,
    to: "/hr/interviews",
    toLabel: "Open interview management",
    tasks: [
      "Add every interviewer with name and email so communications reach them.",
      "Record rating, remarks and outcome for every round — missing feedback stalls approvals.",
      "Move candidates to SELECTED only after all mandatory rounds are complete.",
    ],
  },
  {
    id: "approval",
    step: "04",
    title: "Selection, approvals and offers",
    summary: "Move evaluated candidates from recommended to authorised and offered.",
    icon: ShieldCheck,
    to: "/hr/approvals",
    toLabel: "Open admin approval",
    tasks: [
      "Verify offered salary, expected salary, AI score and HR recommendation.",
      "Approve only after confirming hiring fit and budget ownership.",
      "Use Offers to generate the offer letter, send it and track candidate response.",
    ],
  },
  {
    id: "onboarding",
    step: "05",
    title: "Joining and onboarding",
    summary: "Collect documents, verify each file and convert accepted candidates to employees.",
    icon: ShieldCheck,
    to: "/hr/onboarding",
    toLabel: "Open onboarding",
    tasks: [
      "Send a document reupload or reminder when candidates miss a file.",
      "Accept each document individually; stay traceable for audit queries.",
      "Use Add to Existing only after all required documents are verified.",
    ],
  },
  {
    id: "governance",
    step: "06",
    title: "Access, permissions and SOP audits",
    summary: "Make sure access is least-privilege, current and mapped to actual HR responsibilities.",
    icon: Settings,
    to: "/hr/permissions",
    toLabel: "Open permissions",
    tasks: [
      "Grant View or View & edit per module — avoid broad access for convenience.",
      "Review permissions quarterly and revoke unused or departed-user access.",
      "Use Audit logs and Reports for operational reviews and evidence trails.",
    ],
  },
];

export default function Help() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(MODULES[0].id);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return MODULES;
    return MODULES.filter((module) => [module.title, module.summary, ...module.tasks].some((text) => text.toLowerCase().includes(needle)));
  }, [query]);

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">HR workspace / Help Centre</p>
          <h1 className="page-heading__title">Help &amp; SOP guide</h1>
          <p className="page-heading__subtitle">Searchable operating guide with direct links into every HR module.</p>
        </div>
        <span className="workflow-badge"><CircleHelp size={14} /> Help Centre</span>
      </div>

      <div className="help-search-card">
        <span className="help-search-card__icon"><Search size={20} aria-hidden="true" /></span>
        <input
          type="search"
          className="help-search-card__input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search SOP, module, keyword or action…"
          aria-label="Search help centre"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card help-empty"><CircleHelp size={36} aria-hidden="true" /><h2>No SOP for “{query}”</h2><p>Try a broader term or open the module from the sidebar.</p></div>
      ) : (
        <div className="help-grid help-grid--wide">
          {filtered.map((module) => {
            const Icon = module.icon;
            const expanded = open === module.id;
            return (
              <section className="card help-card help-card--module" key={module.id}>
                <button type="button" className="help-card__toggle" onClick={() => setOpen(expanded ? null : module.id)} aria-expanded={expanded} aria-controls={`help-${module.id}`}>
                  <span className="help-card__step">{module.step}</span>
                  <span className="help-card__icon"><Icon size={21} aria-hidden="true" /></span>
                  <span className="help-card__copy"><span className="help-card__title">{module.title}</span><span className="help-card__summary">{module.summary}</span></span>
                  <ChevronDown className={`help-card__chevron ${expanded ? "open" : ""}`} size={18} aria-hidden="true" />
                </button>
                {expanded && (
                  <div className="help-card__body" id={`help-${module.id}`}>
                    <ol className="help-steps">
                      {module.tasks.map((task, index) => <li key={index}><span>{String(index + 1).padStart(2, "0")}</span>{task}</li>)}
                    </ol>
                    <Link className="help-card__cta" to={module.to}><span>{module.toLabel}</span><ArrowRight size={16} aria-hidden="true" /></Link>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <section className="card help-contact">
        <div>
          <div className="card__title">Need assistance from HR operations?</div>
          <p>Use a module-specific screenshot, the application or employee ID and the exact step where the process is blocked. This makes the audit trail useful and resolution faster.</p>
        </div>
        <a className="btn btn--primary" href="mailto:info@ecometrix.co.in?subject=HR%20Operations%20Support"><Mail size={17} aria-hidden="true" /> Contact HR Operations Desk</a>
      </section>
    </div>
  );
}
