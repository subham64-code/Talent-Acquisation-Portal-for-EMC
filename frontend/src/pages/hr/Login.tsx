import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ClipboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Mail, IdCard, Shield, Eye, EyeOff, Lock, Smartphone, KeyRound } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../lib/api";
import { careerSiteUrl } from "../../lib/appLinks";
import { prefetchRoute } from "../../lib/routePrefetch";

type Role = "ADMIN" | "HR";
type Step = "email" | "totp" | "enrollment";

interface EnrollmentData {
  email: string;
  secret: string;
  uri: string;
  qrDataUrl: string;
  expiresAt: string;
}

const emptyCode = () => Array(6).fill("") as string[];

export default function HRLogin() {
  const [searchParams] = useSearchParams();
  const [selectedRole, setSelectedRole] = useState<Role>(() => searchParams.get("role")?.toLowerCase() === "admin" ? "ADMIN" : "HR");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState<string[]>(emptyCode);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [enrollmentToken, setEnrollmentToken] = useState("");
  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    prefetchRoute("/hr");
    prefetchRoute("/hr/dashboard");
  }, []);

  const redirectFor = (roles: string[] = []) =>
    roles.includes("IT_ADMIN") && !roles.includes("SUPER_ADMIN") ? "/it/dashboard" : "/hr/dashboard";

  const message = (err: any, fallback: string) =>
    err?.response?.data?.error?.message || err?.response?.data?.message || fallback;

  const clearMessages = () => { setError(""); setNotice(""); };

  const pickRole = (role: Role) => {
    setSelectedRole(role);
    setStep("email");
    setError("");
    setNotice("");
    setCode(emptyCode());
    if (role === "ADMIN") setPassword("");
  };

  const validateEmail = () => {
    if (!email.trim()) return "Registered email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address";
    return "";
  };

  const continueWithEmail = async (e?: FormEvent) => {
    e?.preventDefault();
    clearMessages();
    const v = validateEmail();
    if (v) return setError(v);
    setLoading(true);
    try {
      const r = await authApi.checkHrEmail(email.trim());
      setCode(emptyCode());
      if (r.data?.status === "ENROLLMENT_REQUIRED") {
        setNotice(r.data?.message || "Authenticator setup is required. Ask your administrator for a setup link.");
        return;
      }
      setStep("totp");
      setTimeout(() => inputsRef.current[0]?.focus(), 100);
    } catch (err: any) {
      setError(message(err, "This email is not authorized for HR access."));
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...code];
    next[index] = value;
    setCode(next);
    setError("");
    if (value && index < 5) inputsRef.current[index + 1]?.focus();
  };

  const handleCodeKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) inputsRef.current[index - 1]?.focus();
  };

  const handleCodePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = emptyCode();
    text.split("").forEach((ch, i) => { next[i] = ch; });
    setCode(next);
    inputsRef.current[Math.min(text.length, 5)]?.focus();
  };

  const currentCode = () => code.join("");

  const verifyTotp = async () => {
    clearMessages();
    if (currentCode().length !== 6) return setError("Enter the 6-digit code from your authenticator app.");
    setVerifying(true);
    try {
      const r = await authApi.verifyHrTotp(email.trim(), currentCode());
      login(r.data.user);
      navigate(redirectFor(r.data.user?.roles));
    } catch (err: any) {
      setError(message(err, "Invalid or expired code. Please try again."));
      setCode(emptyCode());
      inputsRef.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const openEnrollment = async (token: string) => {
    clearMessages();
    if (!token || token.length < 20) return setError("Invalid setup link.");
    setEnrollmentToken(token);
    setLoading(true);
    try {
      const r = await authApi.startTotpEnrollment(token);
      setEnrollment(r.data);
      setEmail(r.data.email || email);
      setCode(emptyCode());
      setStep("enrollment");
      setTimeout(() => inputsRef.current[0]?.focus(), 100);
    } catch (err: any) {
      setError(message(err, "This setup link is invalid or has expired. Ask your administrator for a new one."));
    } finally {
      setLoading(false);
    }
  };

  const activateAuthenticator = async () => {
    clearMessages();
    if (currentCode().length !== 6) return setError("Enter the 6-digit code shown in your authenticator app.");
    setVerifying(true);
    try {
      const r = await authApi.verifyTotpEnrollment(enrollmentToken, currentCode());
      login(r.data.user);
      navigate(redirectFor(r.data.user?.roles));
    } catch (err: any) {
      setError(message(err, "That code did not match. Check your authenticator and try again."));
      setCode(emptyCode());
      inputsRef.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const loginWithPassword = async (e: FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (!email.trim()) return setError("Administrator email is required");
    if (!password) return setError("Password is required");
    setLoading(true);
    try {
      const r = await authApi.passwordLogin(email.trim(), password);
      login(r.data.user);
      navigate(redirectFor(r.data.user?.roles));
    } catch (err: any) {
      setError(message(err, "Invalid email or password."));
    } finally {
      setLoading(false);
    }
  };

  const changeEmail = () => {
    setStep("email");
    setEnrollment(null);
    setEnrollmentToken("");
    setCode(emptyCode());
    clearMessages();
  };

  // A setup link emailed by an administrator opens the enrollment screen directly.
  useEffect(() => {
    const token = searchParams.get("enrollment");
    if (token) {
      setSelectedRole("HR");
      void openEnrollment(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const codeGrid = (
    <div className="flex justify-center gap-2 flex-wrap" onPaste={handleCodePaste}>
      {code.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el; }}
          value={digit}
          onChange={(e) => handleCodeChange(i, e.target.value)}
          onKeyDown={(e) => handleCodeKeyDown(i, e)}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          aria-label={`Code digit ${i + 1}`}
          className="w-10 h-11 sm:w-11 sm:h-12 text-center text-lg font-semibold text-gray-900 caret-gray-900 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src="/assets/ecometrix-logo.png" alt="Ecometrix logo" className="mx-auto w-[150px] h-auto object-contain" />
          <p className="mt-3 text-sm font-medium text-gray-700">Ecometrix Consultants Pvt. Ltd.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[var(--border)] overflow-hidden">
          <div className="px-6 sm:px-8 pt-7 pb-6">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center gap-2 text-gray-900">
                <IdCard size={22} className="text-brand-600" />
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Talent Acquisition Portal</h1>
              </div>
              <p className="mt-1.5 text-sm text-gray-500">Talent Acquisition &amp; Employee CV Repository</p>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900">Sign In</h2>

              <div className="mt-4 grid grid-cols-2 gap-2" role="tablist" aria-label="Login type">
                {(["HR", "ADMIN"] as Role[]).map((role) => (
                  <button
                    key={role}
                    type="button"
                    role="tab"
                    aria-selected={selectedRole === role}
                    onClick={() => pickRole(role)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                      selectedRole === role
                        ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {role === "HR" ? "HR / Sub HR" : "IT Admin"}
                  </button>
                ))}
              </div>

              {selectedRole === "ADMIN" ? (
                <form onSubmit={loginWithPassword} className="mt-5 space-y-4">
                  <p className="text-sm text-gray-500">IT administrators sign in with their email and password.</p>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Administrator Email</label>
                    <div className="relative">
                      <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-600" />
                      <input
                        type="email"
                        autoComplete="username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="it.admin@emc.example"
                        className="w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Password</label>
                    <div className="relative">
                      <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-600" />
                      <input
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter admin password"
                        className="w-full rounded-xl border border-gray-300 bg-white pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-700"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
                  <button type="submit" disabled={loading} className="w-full btn-primary">
                    <Shield size={18} />
                    {loading ? "Signing in..." : "Sign In"}
                  </button>
                </form>
              ) : (
                <div className="mt-5 space-y-4">
                  {/* Screen 1 — email */}
                  {step === "email" && (
                    <form onSubmit={continueWithEmail} className="space-y-4">
                      <p className="text-sm text-gray-500">Sign in with your registered email and a code from your authenticator app.</p>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">Registered Email</label>
                        <div className="relative">
                          <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-600" />
                          <input
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="hr@emc.example"
                            className={`w-full rounded-xl border bg-white pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${error ? "border-red-400" : "border-gray-300"}`}
                          />
                        </div>
                      </div>
                      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
                      {notice && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">{notice}</p>}
                      <button type="submit" disabled={loading} className="w-full btn-primary">
                        <Shield size={18} />
                        {loading ? "Checking..." : "Continue"}
                      </button>
                    </form>
                  )}

                  {/* Screen 2 — TOTP verification */}
                  {step === "totp" && (
                    <div className="space-y-4">
                      <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500">Signing in as</p>
                          <p className="text-sm font-medium text-gray-900 truncate">{email}</p>
                        </div>
                        <button type="button" onClick={changeEmail} className="text-xs font-medium text-brand-800 hover:underline shrink-0">
                          Change Email
                        </button>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700 text-center">
                          Enter 6-digit authenticator code
                        </label>
                        {codeGrid}
                        <p className="mt-2 text-xs text-gray-500 text-center">Open your authenticator app and enter the current code.</p>
                      </div>
                      {error && <p className="text-xs text-red-600 text-center" role="alert">{error}</p>}
                      <button type="button" onClick={verifyTotp} disabled={verifying} className="w-full btn-primary">
                        <Smartphone size={18} />
                        {verifying ? "Verifying..." : "Verify & Login"}
                      </button>
                    </div>
                  )}

                  {/* Screen 3 — first-time enrollment */}
                  {step === "enrollment" && enrollment && (
                    <div className="space-y-4">
                      <div className="flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5">
                        <KeyRound size={16} className="text-emerald-700 mt-0.5 shrink-0" />
                        <p className="text-xs text-emerald-800">
                          Scan this QR code with Google Authenticator, Microsoft Authenticator, Zoho OneAuth or any RFC 6238 app.
                        </p>
                      </div>
                      <div className="flex justify-center">
                        <img src={enrollment.qrDataUrl} alt="Authenticator QR code" className="w-44 h-44 rounded-lg border border-gray-200 p-1 bg-white" />
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium text-gray-700">Manual setup key</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 break-all rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs font-mono text-gray-800 select-all">
                            {enrollment.secret}
                          </code>
                          <button
                            type="button"
                            onClick={() => { void navigator.clipboard?.writeText(enrollment.secret); }}
                            className="shrink-0 rounded-lg border border-gray-300 px-2.5 py-2 text-xs text-gray-700 hover:bg-gray-50"
                          >
                            Copy
                          </button>
                        </div>
                        <p className="mt-1 text-[11px] text-gray-500">Account: {enrollment.email}</p>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700 text-center">Enter the 6-digit code to activate</label>
                        {codeGrid}
                      </div>
                      {error && <p className="text-xs text-red-600 text-center" role="alert">{error}</p>}
                      <button type="button" onClick={activateAuthenticator} disabled={verifying} className="w-full btn-primary">
                        <Shield size={18} />
                        {verifying ? "Activating..." : "Activate Authenticator"}
                      </button>
                      <div className="text-center">
                        <button type="button" onClick={changeEmail} className="text-xs text-gray-500 hover:text-gray-700 hover:underline">
                          Back to sign in
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          <a href={careerSiteUrl} className="hover:text-gray-700 hover:underline">← Back to careers site</a>
          <span className="mx-2">·</span>© 2026 Ecometrix Consultants Pvt. Ltd. All rights reserved.
        </p>
      </div>
    </div>
  );
}
