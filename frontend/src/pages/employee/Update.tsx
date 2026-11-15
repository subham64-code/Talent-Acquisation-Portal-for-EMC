import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { hrApi, authApi } from "../../lib/api";
import Logo from "../../components/Logo";

const FIELDS: Array<{ key: string; label: string; type: string }> = [
  { key: "fullName", label: "Full Name", type: "text" },
  { key: "employeeCode", label: "Employee ID", type: "text" },
  { key: "officialEmail", label: "Official Email ID", type: "email" },
  { key: "personalEmail", label: "Personal Email ID", type: "email" },
  { key: "mobile", label: "Mobile Number", type: "tel" },
  { key: "departmentId", label: "Department", type: "select" },
  { key: "designationId", label: "Designation", type: "select" },
  { key: "qualification", label: "Highest Educational Qualification", type: "text" },
  { key: "graduationYear", label: "Graduation Year", type: "number" },
  { key: "totalExperience", label: "Total Years of Experience", type: "number" },
  { key: "relevantExperience", label: "Relevant Years of Experience", type: "number" },
  { key: "previousOrganization", label: "Previous Organization", type: "text" },
  { key: "specialization", label: "Current Work Specialization", type: "text" },
  { key: "employmentTypeId", label: "Employment Type", type: "select" },
  { key: "joiningDate", label: "Joining Date", type: "date" },
  { key: "workLocation", label: "Work Location", type: "text" },
  { key: "additionalInfo", label: "Additional Information", type: "text" },
];

export default function EmployeeUpdate() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [step, setStep] = useState<"validating" | "form" | "success">("validating");
  const [employee, setEmployee] = useState<any>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<any[]>([]);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await authApi.validateEmployeeInvitation(token);
        if (cancelled) return;
        setEmployee(r.data.employee);
        setStep("form");
        const [d, de, et] = await Promise.all([
          hrApi.departmentDropdown(),
          hrApi.designations(),
          hrApi.employmentTypes(),
        ]);
        setDepartments(d.data.items ?? d.data);
        setDesignations(de.data.items ?? de.data);
        setEmploymentTypes(et.data.items ?? et.data);
      } catch (err: any) {
        if (cancelled) return;
        setStep("success");
        setError(err.response?.data?.error?.message || "Invalid or expired invitation link.");
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleChange = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => setCvFile(e.target.files?.[0] ?? null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    const fd = new FormData();
    FIELDS.forEach((f) => { if (form[f.key]) fd.append(f.key, form[f.key]); });
    fd.append("departmentId", form.departmentId || "");
    fd.append("designationId", form.designationId || "");
    fd.append("employmentTypeId", form.employmentTypeId || "");
    if (cvFile) fd.append("cv", cvFile);
    try {
      await authApi.submitEmployeeUpdate(token, fd);
      setStep("success");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Submission failed.");
    } finally { setLoading(false); }
  };

  if (step === "validating") return (
    <div className="min-h-screen flex items-center center surface-app"><div className="p-4 ink-soft">Validating invitation…</div></div>
  );
  if (step === "success") return (
    <div className="min-h-screen flex items-center center surface-app">
      <div className="card p-8 mx-auto text-center max-w-md">
        <div className="w-10 h-10 rounded-full bg-[#659616] flex items-center justify-center text-white mx-auto mb-4 font-bold">✓</div>
        <h2 className="text-xl font-bold ink-body mb-2">{error ? "Error" : "Information Submitted"}</h2>
        <p className="ink-soft mb-6">{error || (employee ? `Thank you, ${employee.fullName}. Your employee information has been submitted successfully.` : "")}</p>
        {!error && <button className="btn-primary" onClick={() => navigate("/")}>Return to Careers</button>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen surface-app">
      <div className="max-w-2xl mx-auto p-4">
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Logo size={34} />
            <div className="text-xl font-bold ink-body">Employee Information Update</div>
          </div>
          <p className="ink-soft text-sm mb-6">Hello <span className="font-semibold">{employee?.fullName}</span>, please review and update your information.</p>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {FIELDS.map((f) => (
                <div key={f.key} className="flex flex-col gap-1">
                  <label className="text-sm font-medium ink-soft">{f.label}</label>
                  {f.type === "select"
                    ? f.key === "departmentId"
                      ? <select className="input" value={form[f.key] || ""} onChange={(e) => handleChange(f.key, e.target.value)}>
                          <option value="">Select department</option>
                          {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      : f.key === "designationId"
                        ? <select className="input" value={form[f.key] || ""} onChange={(e) => handleChange(f.key, e.target.value)}>
                            <option value="">Select designation</option>
                            {designations.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        : <select className="input" value={form[f.key] || ""} onChange={(e) => handleChange(f.key, e.target.value)}>
                            <option value="">Select type</option>
                            {employmentTypes.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                    : <input className="input" type={f.type as any} value={form[f.key] || ""} onChange={(e) => handleChange(f.key, e.target.value)} />}
                </div>
              ))}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium ink-soft">Upload Latest CV</label>
                <input type="file" accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png" onChange={handleFile} className="block w-full text-sm ink-soft file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#659616]/50 file:text-[#659616] hover:file:bg-[#659616]/100" />
              </div>
            </div>
            <p className="text-xs ink-soft mt-2">Your latest CV will be stored securely in your employee record.</p>
            <button className="btn-primary w-full mt-2" disabled={loading}>{loading ? "Submitting…" : "Submit Information"}</button>
          </form>
          {error && <div className="mt-4 rounded bg-orange-50 p-3 text-sm text-orange-700 border border-orange-100">{error}</div>}
        </div>
      </div>
    </div>
  );
}
