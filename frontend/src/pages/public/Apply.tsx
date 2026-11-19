import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type DragEvent, type ReactNode } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness, ChevronLeft, Mail, MapPin, Search, ShieldCheck } from "lucide-react";
import { hrApi } from "../../lib/api";
import Logo from "../../components/Logo";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_CV_MB = 10;
const CV_EXTENSIONS = [".pdf", ".doc", ".docx"];

const MOBILE_REGEX = /^[6-9]\d{9}$/;

const emptyForm = {
  jobOpeningId: "",
  fullName: "",
  email: "",
  mobile: "",
  technicalSkills: "",
  totalExperience: "",
};

type FormState = typeof emptyForm;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function Field({ label, required, children, error, hint, id }: { label: string; required?: boolean; children: ReactNode; error?: string; hint?: string; id?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs sm:text-sm font-semibold ink-soft">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] ink-soft">{hint}</p>}
      {error && <p className="text-[11px] font-medium text-red-600">{error}</p>}
    </div>
  );
}

export default function Apply() {
  const [searchParams] = useSearchParams();
  const [openings, setOpenings] = useState<any[]>([]);
  const [form, setForm] = useState<FormState>({ ...emptyForm, jobOpeningId: searchParams.get("job") ?? "" });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [serverError, setServerError] = useState("");
  const [result, setResult] = useState<{ applicationCode: string; jobTitle: string; appliedAt: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    hrApi.publicOpenings({ page: 1, pageSize: 100 })
      .then((r: any) => setOpenings(Array.isArray(r?.data?.items) ? r.data.items : []))
      .catch(() => setOpenings([]));
  }, []);

  const set = (key: keyof FormState, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: "" }));
  };

  const validate = useCallback((): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!form.jobOpeningId) e.jobOpeningId = "Please select the position you are applying for.";
    if (form.fullName.trim().length < 2) e.fullName = "Please enter your full name.";
    if (!MOBILE_REGEX.test(form.mobile.replace(/[\s()-]/g, ""))) e.mobile = "Please enter a valid 10-digit mobile number (starting 6–9).";
    if (!EMAIL_REGEX.test(form.email)) e.email = "Please enter a valid email address.";
    if (!form.technicalSkills.trim()) e.technicalSkills = "Please list your key skills.";
    if (form.totalExperience === "" || Number.isNaN(Number(form.totalExperience)) || Number(form.totalExperience) < 0) {
      e.totalExperience = "Please enter your experience in years (0 for freshers).";
    }
    if (!cvFile) e.cv = "Please attach your resume / CV (PDF, DOC or DOCX).";
    return e;
  }, [form, cvFile]);

  const cvValidate = useCallback((file: File): string => {
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!CV_EXTENSIONS.includes(ext)) return "Only PDF, DOC and DOCX files are supported.";
    if (file.size > MAX_CV_MB * 1024 * 1024) return `File too large. Maximum ${MAX_CV_MB} MB.`;
    if (file.size === 0) return "The selected file is empty.";
    return "";
  }, []);

  const acceptFile = useCallback((file: File | null | undefined) => {
    if (!file) return;
    const err = cvValidate(file);
    if (err) { setErrors((p) => ({ ...p, cv: err })); setCvFile(null); return; }
    setCvFile(file);
    setErrors((p) => ({ ...p, cv: "" }));
  }, [cvValidate]);

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    acceptFile(e.dataTransfer.files?.[0]);
  }, [acceptFile]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError("");
    const found = validate();
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      const firstKey = Object.keys(found).find((k) => found[k]);
      const el = firstKey ? document.getElementById(`field-${firstKey}`) : null;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    setUploadProgress(0);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v !== "") fd.append(k, v); });
    if (cvFile) fd.append("cv", cvFile);
    try {
      const r: any = await hrApi.publicApply(fd, (pct) => setUploadProgress(pct));
      const app = r?.data?.application;
      setResult({
        applicationCode: app?.applicationCode ?? "—",
        jobTitle: app?.jobTitle ?? openings.find((o) => o.id === form.jobOpeningId)?.title ?? "",
        appliedAt: app?.appliedAt ?? new Date().toISOString(),
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setServerError(err.response?.data?.error?.message || "Application could not be submitted. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedJob = useMemo(() => openings.find((o) => o.id === form.jobOpeningId), [openings, form.jobOpeningId]);

  if (!form.jobOpeningId) {
    return (
      <div className="min-h-screen surface-app public-light">
        <PublicHeader />
        <main className="max-w-xl mx-auto px-4 py-20 text-center">
          <div className="why-card"><BriefcaseBusiness size={46} className="mx-auto mb-4 text-[#659616]" aria-hidden="true" /><h1 className="font-extrabold ink-body text-2xl">Choose a role first</h1><p className="ink-soft mt-2">Application access now starts from the Careers page. Select the role you want and submit your application there.</p><Link to="/career" className="careers-primary mt-6">Browse Careers <ArrowRight size={16} aria-hidden="true" /></Link></div>
        </main>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen surface-app public-light">
        <PublicHeader />
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="card p-8 sm:p-12 text-center animate-pop">
            <div className="w-20 h-20 mx-auto rounded-full bg-[#659616]/15 flex items-center justify-center mb-5">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#659616" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <h2 className="text-2xl font-extrabold ink-body">Application Submitted!</h2>
            <p className="ink-soft mt-2 max-w-md mx-auto">
              Thank you, <span className="font-semibold ink-body">{form.fullName}</span>. Your application for{" "}
              <span className="font-semibold ink-body">{result.jobTitle}</span> has been received. A confirmation email is on its way to{" "}
              <span className="font-semibold ink-body">{form.email}</span>.
            </p>
            <div className="inline-flex flex-col items-center gap-1 mt-6 rounded-2xl border border-[#659616]/30 bg-[#659616]/5 px-8 py-5">
              <span className="text-[10px] uppercase tracking-[0.2em] ink-soft font-bold">Application ID</span>
              <span className="text-2xl sm:text-3xl font-black text-[#659616] font-mono tracking-wider">{result.applicationCode}</span>
              <span className="text-[11px] ink-soft">Submitted on {new Date(result.appliedAt).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}</span>
            </div>
            <p className="text-[11px] ink-soft mt-5">Save this Application ID — quote it in any correspondence with EMC HR.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
              <Link to="/career" className="px-6 py-3 rounded-lg border border-[#171717]/15 ink-body text-sm font-semibold hover:bg-[#171717]/5">Back to Careers</Link>
              <Link to="/careers/jobs" className="btn-primary px-6 py-3">Browse more openings</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen surface-app public-light">
      <PublicHeader />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="careers-apply-hero">
          <div className="careers-breadcrumb"><Link to="/career">Home</Link><span>›</span><span>Careers</span></div>
          <span className="careers-kicker">Applications</span>
          <h1 className="careers-title !text-[2.3rem] sm:!text-[3.2rem]">Join the <span>Ecometrix Team</span></h1>
          <p className="careers-lead !text-[0.95rem]">Fill in your details and attach your resume — it takes less than two minutes.</p>
        </div>

        {serverError && (
          <div className="mb-4 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800">{serverError}</div>
        )}

        <form onSubmit={submit} noValidate className="card p-5 sm:p-7 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name" required error={errors.fullName} id="field-fullName">
              <input id="field-fullName" className="input" placeholder="e.g. Subham Behera" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
            </Field>
            <Field label="Mobile Number" required error={errors.mobile} hint="10-digit Indian mobile number (starts with 6–9)." id="field-mobile">
              <input id="field-mobile" type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} className="input" placeholder="9876543210" value={form.mobile} onChange={(e) => set("mobile", e.target.value.replace(/[^0-9]/g, "").slice(0, 10))} />
            </Field>
            <Field label="Email Address" required error={errors.email} id="field-email">
              <input id="field-email" type="email" className="input" placeholder="name@example.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            {selectedJob ? (
              <div className="sm:col-span-2 careers-apply-role">
                <span className="careers-apply-role__icon"><BriefcaseBusiness size={20} aria-hidden="true" /></span>
                <span>
                  <span className="careers-apply-role__label">Applying for</span>
                  <span className="careers-apply-role__title">{selectedJob.title}</span>
                  <span className="careers-apply-role__meta">{selectedJob.department?.name || "EMC"}{selectedJob.location ? ` · ${selectedJob.location}` : ""}</span>
                </span>
              </div>
            ) : (
              <div className="sm:col-span-2 careers-apply-role careers-apply-role--missing">
                <span><span className="careers-apply-role__label">Application unavailable</span><span className="careers-apply-role__title">Please choose a position from Careers first.</span></span>
              </div>
            )}
            <div className="sm:col-span-2">
              <Field label="Skills" required error={errors.technicalSkills} hint="Comma-separated, e.g. AutoCAD, ArcGIS, Python, Project Management" id="field-technicalSkills">
                <input id="field-technicalSkills" className="input" placeholder="AutoCAD, ArcGIS, Python" value={form.technicalSkills} onChange={(e) => set("technicalSkills", e.target.value)} />
              </Field>
            </div>
            <Field label="Experience (years)" required error={errors.totalExperience} hint="Enter 0 if you are a fresher." id="field-totalExperience">
              <input id="field-totalExperience" type="number" min={0} step="0.5" className="input" placeholder="e.g. 2" value={form.totalExperience} onChange={(e) => set("totalExperience", e.target.value)} />
            </Field>
          </div>

          <div>
            <span className="text-xs sm:text-sm font-semibold ink-soft block mb-2">Resume / CV <span className="text-red-500">*</span></span>
            <div
              id="field-cv"
              role="button"
              tabIndex={0}
              aria-label="Upload resume"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              className={`relative rounded-2xl border-2 border-dashed px-6 py-8 text-center cursor-pointer transition-all duration-200 outline-none select-none ${dragActive ? "border-[#FF9412] bg-[#FF9412]/10 scale-[1.01]" : cvFile ? "border-[#659616]/60 bg-[#659616]/5" : "border-[#659616]/40 bg-[#659616]/5 hover:border-[#659616] hover:bg-[#659616]/10"} ${errors.cv ? "!border-red-400" : ""}`}
            >
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => acceptFile(e.target.files?.[0])} />
              {!cvFile ? (
                <>
                  <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[#659616] to-[#4C730D] flex items-center justify-center shadow-[0_8px_24px_rgba(122,180,27,.35)]">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></svg>
                  </div>
                  <p className="font-bold ink-body">Drag &amp; drop your resume here</p>
                  <p className="text-xs ink-soft mt-1">or <span className="text-[#659616] font-semibold underline underline-offset-2">browse from your device</span></p>
                  <p className="text-[10px] ink-soft mt-3 tracking-wide uppercase">PDF · DOC · DOCX &nbsp;|&nbsp; Max {MAX_CV_MB} MB</p>
                </>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4" onClick={(e) => e.stopPropagation()}>
                  <div className="w-14 h-14 rounded-xl bg-[#659616]/15 flex items-center justify-center text-2xl">📄</div>
                  <div className="text-left min-w-0">
                    <p className="font-semibold ink-body text-sm break-all">{cvFile.name}</p>
                    <p className="text-[11px] ink-soft mt-0.5">{formatBytes(cvFile.size)} · <span className="text-[#659616] font-semibold">Ready to upload</span></p>
                    <div className="flex gap-2 mt-2">
                      <button type="button" className="text-xs font-semibold text-[#659616] border border-[#659616]/40 rounded-md px-2.5 py-1 hover:bg-[#659616]/10" onClick={() => fileInputRef.current?.click()}>Replace</button>
                      <button type="button" className="text-xs font-semibold text-red-600 border border-red-300 rounded-md px-2.5 py-1 hover:bg-red-50" onClick={() => setCvFile(null)}>Remove</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {errors.cv && <p className="text-[11px] font-medium text-red-600 mt-1.5">{errors.cv}</p>}
          </div>

          {submitting && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold ink-soft">Uploading your application…</span>
                <span className="text-xs font-bold text-[#659616] tabular-nums">{uploadProgress}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-[#171717]/10 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#84BD26] via-[#659616] to-[#4C730D] transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary w-full py-3.5 text-base" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit Application"}
          </button>
          <p className="text-[10px] ink-soft text-center">By submitting you consent to EMC processing these details for recruitment purposes.</p>
        </form>
      </div>
    </div>
  );
}

function PublicHeader() {
  return (
    <nav className="corporate-header" aria-label="Ecometrix careers">
      <div className="corporate-header__inner">
        <Link to="/career" className="corporate-logo"><Logo size={46} /></Link>
        <nav className="corporate-nav" aria-label="Career sections">
          <Link to="/career" className="corporate-nav__link">Home</Link>
          <Link to="/career" className="corporate-nav__link">About Us</Link>
          <Link to="/career" className="corporate-nav__link">Our Services</Link>
          <Link to="/career" className="corporate-nav__link">Delivery Experience</Link>
          <Link to="/career" className="corporate-nav__link">Our People</Link>
          <Link className="corporate-nav__link active" to="/career" aria-current="page">Careers</Link>
          <a className="corporate-nav__link" href="mailto:info@ecometrix.co.in">Contact</a>
        </nav>
        <Link to="/careers/jobs" className="corporate-connect">View all jobs <ArrowRight size={13} aria-hidden="true" /></Link>
      </div>
    </nav>
  );
}
