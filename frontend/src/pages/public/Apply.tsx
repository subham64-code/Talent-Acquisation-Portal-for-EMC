import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type DragEvent, type ReactNode } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { hrApi } from "../../lib/api";
import Logo from "../../components/Logo";
import SearchableSelect from "../../components/SearchableSelect";
import { COUNTRIES, QUALIFICATIONS, EMPLOYMENT_STATUS, NOTICE_PERIODS } from "../../lib/locationData";

const MOBILE_REGEX = /^[6-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_CV_MB = 10;
const CV_EXTENSIONS = [".pdf", ".doc", ".docx"];

const emptyForm: Record<string, string> = {
  jobOpeningId: "",
  fullName: "",
  email: "",
  mobile: "",
  dateOfBirth: "",
  gender: "",
  currentAddress: "",
  country: "India",
  state: "",
  city: "",
  currentLocation: "",
  qualifications: "",
  highestQualification: "",
  course: "",
  specializationStream: "",
  college: "",
  passingYear: "",
  percentage: "",
  totalExperience: "0",
  relevantExperience: "0",
  currentCompany: "",
  currentDesignation: "",
  department: "",
  workSpecialization: "",
  technicalSkills: "",
  professionalSkills: "",
  employmentStatus: "",
  expectedSalary: "",
  noticePeriod: "",
  linkedin: "",
  coverLetter: "",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function Field({ label, required, children, error, hint }: { label: string; required?: boolean; children: ReactNode; error?: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs sm:text-sm font-semibold ink-soft">
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
  const navigate = useNavigate();
  const [openings, setOpenings] = useState<any[]>([]);
  const [form, setForm] = useState<Record<string, string>>({ ...emptyForm, jobOpeningId: searchParams.get("job") ?? "" });
  const [qualifications, setQualifications] = useState<string[]>([]);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"details" | "review" | "done">("details");
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

  const set = (key: string, value: string) => {
    setForm((p) => {
      const next = { ...p, [key]: value };
      if (key === "country") { next.state = ""; next.city = ""; }
      if (key === "state") { next.city = ""; }
      return next;
    });
    setErrors((p) => ({ ...p, [key]: "" }));
  };

  const toggleQualification = (q: string) => {
    setQualifications((prev) => prev.includes(q) ? prev.filter((x) => x !== q) : [...prev, q]);
    setErrors((p) => ({ ...p, qualifications: "" }));
  };

  const selectedCountry = COUNTRIES.find((c) => c.name === form.country);
  const states = selectedCountry?.states ?? [];
  const selectedState = states.find((s) => s.name === form.state);
  const cities = selectedState?.cities.map((c) => c.name) ?? [];
  const freeTextLocation = form.country === "Other" || (selectedCountry && selectedCountry.states.length === 0);

  const mobileDigits = form.mobile.replace(/\D/g, "");
  const mobileValid = MOBILE_REGEX.test(form.mobile);
  const mobileHint = mobileDigits.length === 0
    ? "10-digit Indian mobile number"
    : mobileValid
      ? "✓ Valid mobile number"
      : `${mobileDigits.length}/10 digits · ${Math.max(0, 10 - mobileDigits.length)} remaining`;

  const validate = useCallback((): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!form.jobOpeningId) e.jobOpeningId = "Please select the position you are applying for.";
    if (form.fullName.trim().length < 2) e.fullName = "Please enter your full name.";
    if (!EMAIL_REGEX.test(form.email)) e.email = "Please enter a valid email address.";
    if (!MOBILE_REGEX.test(form.mobile)) e.mobile = "Mobile number must be exactly 10 digits (starting 6-9).";
    if (!form.country) e.country = "Please select your country.";
    if (!form.state.trim()) e.state = "Please select your state.";
    if (!form.city.trim()) e.city = "Please select your city.";
    if (qualifications.length === 0) e.qualifications = "Select at least one qualification.";
    if (!form.highestQualification) e.highestQualification = "Please select your highest qualification.";
    const exp = Number(form.totalExperience);
    if (form.totalExperience !== "" && (!Number.isFinite(exp) || exp < 0)) e.totalExperience = "Experience cannot be negative.";
    const rexp = Number(form.relevantExperience);
    if (form.relevantExperience !== "" && (!Number.isFinite(rexp) || rexp < 0)) e.relevantExperience = "Experience cannot be negative.";
    if (form.passingYear && (Number(form.passingYear) < 1950 || Number(form.passingYear) > new Date().getFullYear() + 10)) e.passingYear = "Please enter a valid passing year.";
    if (!cvFile) e.cv = "Please attach your CV (PDF, DOC or DOCX).";
    return e;
  }, [form, cvFile, qualifications]);

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

  const goToReview = (e: FormEvent) => {
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
    setForm((p) => ({
      ...p,
      currentLocation: [p.currentAddress, p.city, p.state, p.country].filter(Boolean).join(", "),
    }));
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    setSubmitting(true);
    setUploadProgress(0);
    setServerError("");
    const fd = new FormData();
    Object.entries({
      ...form,
      qualifications: qualifications.join(", "),
    }).forEach(([k, v]) => { if (v !== "" && v !== undefined && v !== null) fd.append(k, v); });
    if (cvFile) fd.append("cv", cvFile);
    try {
      const r: any = await hrApi.publicApply(fd, (pct) => setUploadProgress(pct));
      const app = r?.data?.application;
      setResult({
        applicationCode: app?.applicationCode ?? "—",
        jobTitle: app?.jobTitle ?? openings.find((o) => o.id === form.jobOpeningId)?.title ?? "",
        appliedAt: app?.appliedAt ?? new Date().toISOString(),
      });
      setStep("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setServerError(err.response?.data?.error?.message || "Application could not be submitted. Please try again.");
      setStep("details");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedJob = openings.find((o) => o.id === form.jobOpeningId);
  const progressSteps = ["Details", "Review", "Submitted"];
  const currentStep = step === "details" ? 0 : step === "review" ? 1 : 2;

  const reviewRows = useMemo(() => [
    ["Position applied", selectedJob ? `${selectedJob.title}${selectedJob.department?.name ? ` — ${selectedJob.department.name}` : ""}` : form.jobOpeningId],
    ["Full name", form.fullName],
    ["Email", form.email],
    ["Mobile", form.mobile],
    ["Date of birth", form.dateOfBirth || "—"],
    ["Gender", form.gender || "—"],
    ["Location", [form.currentAddress, form.city, form.state, form.country].filter(Boolean).join(", ")],
    ["Qualifications", qualifications.join(", ") || "—"],
    ["Highest qualification", `${form.highestQualification || "—"}${form.course ? ` · ${form.course}` : ""}`],
    ["Stream / Specialization", form.specializationStream || "—"],
    ["College / University", form.college || "—"],
    ["Passing year · Score", [form.passingYear, form.percentage].filter(Boolean).join(" · ") || "—"],
    ["Experience", `${form.totalExperience || 0} yrs total · ${form.relevantExperience || 0} yrs relevant`],
    ["Current organization", form.currentCompany || "—"],
    ["Current designation", form.currentDesignation || "—"],
    ["Department / Specialization", [form.department, form.workSpecialization].filter(Boolean).join(" · ") || "—"],
    ["Technical skills", form.technicalSkills || "—"],
    ["Professional skills", form.professionalSkills || "—"],
    ["Employment status", form.employmentStatus || "—"],
    ["Expected salary", form.expectedSalary || "—"],
    ["Notice period", form.noticePeriod || "—"],
    ["LinkedIn", form.linkedin || "—"],
  ], [form, qualifications, selectedJob]);

  return (
    <div className="min-h-screen surface-app">
      {/* Public header */}
      <nav className="surface-ink border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/career" className="flex items-center gap-2">
            <Logo size={30} />
            <span className="font-bold text-white">EMC<span className="text-[#F28C28]">.</span> Careers</span>
          </Link>
          <Link to="/careers/jobs" className="px-4 py-2 rounded-lg border border-white/25 text-white text-sm font-medium hover:bg-white/10">
            View all jobs
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress stepper */}
        <ol className="flex items-center justify-center gap-2 sm:gap-6 mb-8">
          {progressSteps.map((label, i) => {
            const done = i < currentStep;
            const active = i === currentStep;
            return (
              <li key={label} className="flex items-center gap-2 sm:gap-3">
                <span className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold border transition-colors ${done ? "bg-[#198754] border-[#198754] text-white" : active ? "border-[#F28C28] text-[#F28C28] bg-[#F28C28]/10" : "border-[#171717]/15 text-[#171717]/40"}`}>
                  {done ? "✓" : i + 1}
                </span>
                <span className={`text-xs sm:text-sm font-semibold ${active ? "ink-body" : "ink-soft"}`}>{label}</span>
                {i < progressSteps.length - 1 && <span className="w-6 sm:w-14 h-px bg-[#171717]/15 hidden xs:block" />}
              </li>
            );
          })}
        </ol>

        {serverError && (
          <div className="mb-4 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800">{serverError}</div>
        )}

        {/* ============ STEP 1 — DETAILS ============ */}
        {step === "details" && (
          <form onSubmit={goToReview} noValidate className="space-y-6">
            <div className="card p-5 sm:p-6">
              <h2 className="text-base sm:text-lg font-extrabold ink-body mb-1"><span className="text-[#F28C28]">1.</span> Personal Information</h2>
              <p className="text-xs ink-soft mb-5">All fields marked <span className="text-red-500">*</span> are mandatory.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name" required error={errors.fullName}>
                  <input id="field-fullName" className="input" placeholder="e.g. Subham Behera" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
                </Field>
                <Field label="Email Address" required error={errors.email}>
                  <input id="field-email" type="email" className="input" placeholder="name@example.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
                </Field>
                <Field label="Mobile Number" required error={errors.mobile} hint={mobileHint}>
                  <input
                    id="field-mobile"
                    className={`input tracking-widest font-semibold ${mobileValid ? "!border-[#198754]/60" : ""}`}
                    inputMode="numeric"
                    placeholder="9876543210"
                    value={form.mobile}
                    onChange={(e) => set("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
                    aria-describedby="mobile-counter"
                  />
                  <div id="mobile-counter" className="flex items-center justify-between mt-1">
                    <div className="h-1.5 flex-1 rounded bg-[#171717]/10 overflow-hidden mr-2">
                      <div className={`h-full transition-all duration-200 ${mobileValid ? "bg-[#198754]" : "bg-[#F28C28]"}`} style={{ width: `${Math.min(100, (mobileDigits.length / 10) * 100)}%` }} />
                    </div>
                    <span className={`text-[10px] font-bold tabular-nums ${mobileValid ? "text-[#198754]" : "ink-soft"}`}>{mobileDigits.length}/10</span>
                  </div>
                </Field>
                <Field label="Date of Birth">
                  <input type="date" className="input" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} max={new Date().toISOString().slice(0, 10)} />
                </Field>
                <Field label="Gender">
                  <select className="select" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                    <option value="">Prefer not to say</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Current Address">
                    <input className="input" placeholder="Flat / House no., street, area" value={form.currentAddress} onChange={(e) => set("currentAddress", e.target.value)} />
                  </Field>
                </div>
                <Field label="Country" required error={errors.country}>
                  <SearchableSelect id="field-country" value={form.country} onChange={(v) => set("country", v)} options={COUNTRIES.map((c) => c.name)} placeholder="Select country" />
                </Field>
                <Field label="State / UT" required error={errors.state}>
                  {freeTextLocation
                    ? <input id="field-state" className="input" placeholder="Enter state / region" value={form.state} onChange={(e) => set("state", e.target.value)} />
                    : <SearchableSelect id="field-state" value={form.state} onChange={(v) => set("state", v)} options={states.map((s) => s.name)} placeholder={form.country ? "Select state" : "Select country first"} disabled={!form.country} />}
                </Field>
                <Field label="City" required error={errors.city}>
                  {freeTextLocation
                    ? <input id="field-city" className="input" placeholder="Enter city" value={form.city} onChange={(e) => set("city", e.target.value)} />
                    : <SearchableSelect id="field-city" value={form.city} onChange={(v) => set("city", v)} options={cities} placeholder={form.state ? "Select city" : "Select state first"} disabled={!form.state} />}
                </Field>
                <Field label="Complete Location" hint="Auto-filled from your address and selection — edit if needed.">
                  <input className="input" placeholder="City, State, Country" value={form.currentLocation} onChange={(e) => set("currentLocation", e.target.value)} />
                </Field>
              </div>
            </div>

            <div className="card p-5 sm:p-6">
              <h2 className="text-base sm:text-lg font-extrabold ink-body mb-1"><span className="text-[#F28C28]">2.</span> Qualifications &amp; Education</h2>
              <p className="text-xs ink-soft mb-5">Select all that apply, then fill in your highest qualification.</p>

              <div className="mb-4">
                <span className="text-xs sm:text-sm font-semibold ink-soft block mb-2">Qualifications <span className="text-red-500">*</span></span>
                <div className="flex flex-wrap gap-2">
                  {QUALIFICATIONS.map((q) => {
                    const active = qualifications.includes(q);
                    return (
                      <button
                        key={q}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleQualification(q)}
                        className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${active ? "bg-[#198754] border-[#198754] text-white shadow-[0_2px_10px_rgba(25,135,84,.35)]" : "border-[#171717]/15 ink-soft hover:border-[#198754]/50 hover:text-[#198754]"}`}
                      >
                        {q}
                      </button>
                    );
                  })}
                </div>
                {errors.qualifications && <p className="text-[11px] font-medium text-red-600 mt-1">{errors.qualifications}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Highest Qualification" required error={errors.highestQualification}>
                  <select id="field-highestQualification" className="select" value={form.highestQualification} onChange={(e) => set("highestQualification", e.target.value)}>
                    <option value="">Select…</option>
                    {QUALIFICATIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                  </select>
                </Field>
                <Field label="Course / Degree">
                  <input className="input" placeholder="e.g. B.Tech Civil Engineering" value={form.course} onChange={(e) => set("course", e.target.value)} />
                </Field>
                <Field label="Stream / Specialization">
                  <input className="input" placeholder="e.g. Water Resources & GIS" value={form.specializationStream} onChange={(e) => set("specializationStream", e.target.value)} />
                </Field>
                <Field label="College / University">
                  <input className="input" placeholder="e.g. NIT Trichy" value={form.college} onChange={(e) => set("college", e.target.value)} />
                </Field>
                <Field label="Passing Year" error={errors.passingYear}>
                  <input id="field-passingYear" type="number" min={1950} max={new Date().getFullYear() + 10} className="input" placeholder="e.g. 2022" value={form.passingYear} onChange={(e) => set("passingYear", e.target.value)} />
                </Field>
                <Field label="Percentage / CGPA">
                  <input className="input" placeholder="e.g. 78% or 8.4 CGPA" value={form.percentage} onChange={(e) => set("percentage", e.target.value)} />
                </Field>
              </div>
            </div>

            <div className="card p-5 sm:p-6">
              <h2 className="text-base sm:text-lg font-extrabold ink-body mb-1"><span className="text-[#F28C28]">3.</span> Professional Experience</h2>
              <p className="text-xs ink-soft mb-5">Freshers: enter 0. Experience fields are never forced.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Total Years of Experience" error={errors.totalExperience}>
                  <input id="field-totalExperience" type="number" min={0} step="0.5" className="input" value={form.totalExperience} onChange={(e) => set("totalExperience", e.target.value)} />
                </Field>
                <Field label="Relevant Years of Experience" error={errors.relevantExperience}>
                  <input id="field-relevantExperience" type="number" min={0} step="0.5" className="input" value={form.relevantExperience} onChange={(e) => set("relevantExperience", e.target.value)} />
                </Field>
                <Field label="Current / Previous Company">
                  <input className="input" placeholder="e.g. Larsen & Toubro" value={form.currentCompany} onChange={(e) => set("currentCompany", e.target.value)} />
                </Field>
                <Field label="Current / Previous Designation">
                  <input className="input" placeholder="e.g. Site Engineer" value={form.currentDesignation} onChange={(e) => set("currentDesignation", e.target.value)} />
                </Field>
                <Field label="Department">
                  <input className="input" placeholder="e.g. Civil / GIS / Water Supply" value={form.department} onChange={(e) => set("department", e.target.value)} />
                </Field>
                <Field label="Work Specialization">
                  <input className="input" placeholder="e.g. Drainage master planning" value={form.workSpecialization} onChange={(e) => set("workSpecialization", e.target.value)} />
                </Field>
                <Field label="Technical Skills" hint="Comma-separated, e.g. AutoCAD, ArcGIS, MS Project">
                  <input className="input" placeholder="AutoCAD, ArcGIS, QGIS, STAAD Pro" value={form.technicalSkills} onChange={(e) => set("technicalSkills", e.target.value)} />
                </Field>
                <Field label="Professional Skills" hint="Comma-separated">
                  <input className="input" placeholder="Client handling, team coordination, report writing" value={form.professionalSkills} onChange={(e) => set("professionalSkills", e.target.value)} />
                </Field>
                <Field label="Current Employment Status">
                  <select className="select" value={form.employmentStatus} onChange={(e) => set("employmentStatus", e.target.value)}>
                    <option value="">Select…</option>
                    {EMPLOYMENT_STATUS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Expected Salary (CTC)">
                  <input className="input" placeholder="e.g. 8 LPA" value={form.expectedSalary} onChange={(e) => set("expectedSalary", e.target.value)} />
                </Field>
                <Field label="Notice Period">
                  <select className="select" value={form.noticePeriod} onChange={(e) => set("noticePeriod", e.target.value)}>
                    <option value="">Select…</option>
                    {NOTICE_PERIODS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="LinkedIn Profile">
                  <input className="input" type="url" placeholder="https://linkedin.com/in/you" value={form.linkedin} onChange={(e) => set("linkedin", e.target.value)} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Cover Letter / Additional Information">
                    <textarea className="input" rows={3} placeholder="Why should we hire you? Mention anything else we should know." value={form.coverLetter} onChange={(e) => set("coverLetter", e.target.value)} />
                  </Field>
                </div>
              </div>
            </div>

            <div className="card p-5 sm:p-6">
              <h2 className="text-base sm:text-lg font-extrabold ink-body mb-1"><span className="text-[#F28C28]">4.</span> Position &amp; CV</h2>
              <p className="text-xs ink-soft mb-5">Choose the role and upload your latest CV.</p>

              <div className="grid grid-cols-1 gap-4">
                <Field label="Job Opening" required error={errors.jobOpeningId}>
                  <select id="field-jobOpeningId" className="select" value={form.jobOpeningId} onChange={(e) => set("jobOpeningId", e.target.value)}>
                    <option value="">Select a position…</option>
                    {openings.map((o) => <option key={o.id} value={o.id}>{o.title} — {o.department?.name ?? "EMC"}{o.location ? ` · ${o.location}` : ""}</option>)}
                  </select>
                </Field>

                <div>
                  <span className="text-xs sm:text-sm font-semibold ink-soft block mb-2">Upload CV <span className="text-red-500">*</span></span>
                  <div
                    id="field-cv"
                    role="button"
                    tabIndex={0}
                    aria-label="Upload CV"
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }}
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={onDrop}
                    className={`relative rounded-2xl border-2 border-dashed px-6 py-8 sm:py-10 text-center cursor-pointer transition-all duration-200 outline-none select-none ${dragActive ? "border-[#F28C28] bg-[#F28C28]/10 scale-[1.01]" : cvFile ? "border-[#198754]/60 bg-[#198754]/5" : "border-[#198754]/40 bg-[#198754]/5 hover:border-[#198754] hover:bg-[#198754]/10 focus:border-[#198754]"} ${errors.cv ? "!border-red-400" : ""}`}
                  >
                    <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => acceptFile(e.target.files?.[0])} />
                    {!cvFile ? (
                      <>
                        <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[#198754] to-[#146C43] flex items-center justify-center shadow-[0_8px_24px_rgba(25,135,84,.35)]">
                          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>
                        </div>
                        <p className="font-bold ink-body">Drag &amp; drop your CV here</p>
                        <p className="text-xs ink-soft mt-1">or <span className="text-[#198754] font-semibold underline underline-offset-2">browse from your device</span></p>
                        <p className="text-[10px] ink-soft mt-3 tracking-wide uppercase">PDF · DOC · DOCX &nbsp;|&nbsp; Max {MAX_CV_MB} MB</p>
                      </>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-center gap-4" onClick={(e) => e.stopPropagation()}>
                        <div className="w-14 h-14 rounded-xl bg-[#198754]/15 flex items-center justify-center text-2xl">📄</div>
                        <div className="text-left min-w-0">
                          <p className="font-semibold ink-body text-sm break-all">{cvFile.name}</p>
                          <p className="text-[11px] ink-soft mt-0.5">{formatBytes(cvFile.size)} · {cvFile.type === "application/pdf" ? "PDF Document" : "Word Document"} · <span className="text-[#198754] font-semibold">Ready to upload</span></p>
                          <div className="flex gap-2 mt-2">
                            <button type="button" className="text-xs font-semibold text-[#198754] border border-[#198754]/40 rounded-md px-2.5 py-1 hover:bg-[#198754]/10" onClick={() => fileInputRef.current?.click()}>Replace</button>
                            <button type="button" className="text-xs font-semibold text-red-600 border border-red-300 rounded-md px-2.5 py-1 hover:bg-red-50" onClick={() => setCvFile(null)}>Remove</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {errors.cv && <p className="text-[11px] font-medium text-red-600 mt-1.5">{errors.cv}</p>}
                </div>
              </div>

              <button type="submit" className="btn-primary w-full py-3.5 mt-5 text-base">
                Review &amp; Submit →
              </button>
            </div>
          </form>
        )}

        {/* ============ STEP 2 — REVIEW ============ */}
        {step === "review" && (
          <div className="card p-5 sm:p-6 animate-in">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-lg bg-[#F28C28]/15 flex items-center justify-center">📝</div>
              <h2 className="text-lg font-extrabold ink-body">Review your application</h2>
            </div>
            <p className="text-xs ink-soft mb-5">Please verify every detail below. You can go back to edit anything before submitting.</p>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {reviewRows.map(([k, v]) => (
                <div key={k as string} className="border-b border-[#171717]/8 pb-2">
                  <dt className="text-[10px] uppercase tracking-wider ink-soft font-bold">{k}</dt>
                  <dd className="ink-body font-medium break-words">{v}</dd>
                </div>
              ))}
              <div className="border-b border-[#171717]/8 pb-2">
                <dt className="text-[10px] uppercase tracking-wider ink-soft font-bold">CV</dt>
                <dd className="ink-body font-medium">{cvFile?.name} · {cvFile ? formatBytes(cvFile.size) : ""}</dd>
              </div>
            </dl>

            {submitting && (
              <div className="mt-5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold ink-soft">Uploading your application…</span>
                  <span className="text-xs font-bold text-[#198754] tabular-nums">{uploadProgress}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-[#171717]/10 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#2BA56D] via-[#198754] to-[#146C43] transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button className="px-6 py-3 rounded-lg border border-[#171717]/15 ink-body text-sm font-semibold hover:bg-[#171717]/5" onClick={() => setStep("details")} disabled={submitting}>
                ← Back to edit
              </button>
              <button className="flex-1 btn-primary py-3 text-base" onClick={submit} disabled={submitting}>
                {submitting ? "Submitting…" : "✓ Submit Application"}
              </button>
            </div>
            <p className="text-[10px] ink-soft mt-3 text-center">By submitting you consent to EMC processing these details for recruitment purposes.</p>
          </div>
        )}

        {/* ============ STEP 3 — DONE ============ */}
        {step === "done" && result && (
          <div className="card p-8 sm:p-12 text-center animate-pop">
            <div className="w-20 h-20 mx-auto rounded-full bg-[#198754]/15 flex items-center justify-center mb-5">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#198754" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <h2 className="text-2xl font-extrabold ink-body">Application Submitted!</h2>
            <p className="ink-soft mt-2 max-w-md mx-auto">Thank you, <span className="font-semibold ink-body">{form.fullName}</span>. Your application for <span className="font-semibold ink-body">{result.jobTitle}</span> has been received. A confirmation email is on its way to <span className="font-semibold ink-body">{form.email}</span>.</p>
            <div className="inline-flex flex-col items-center gap-1 mt-6 rounded-2xl border border-[#198754]/30 bg-[#198754]/5 px-8 py-5">
              <span className="text-[10px] uppercase tracking-[0.2em] ink-soft font-bold">Application ID</span>
              <span className="text-2xl sm:text-3xl font-black text-[#198754] font-mono tracking-wider">{result.applicationCode}</span>
              <span className="text-[11px] ink-soft">Submitted on {new Date(result.appliedAt).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}</span>
            </div>
            <p className="text-[11px] ink-soft mt-5">Save this Application ID — quote it in any correspondence with EMC HR.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
              <Link to="/career" className="px-6 py-3 rounded-lg border border-[#171717]/15 ink-body text-sm font-semibold hover:bg-[#171717]/5">Back to Careers</Link>
              <Link to="/careers/jobs" className="btn-primary px-6 py-3">Browse more openings</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
