import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ClipboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, IdCard, Shield, Eye, EyeOff, Lock } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../lib/api";

type Role = "ADMIN" | "HR";

export default function HRLogin() {
  const [selectedRole, setSelectedRole] = useState<Role>("HR");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [success, setSuccess] = useState("");
  const [timer, setTimer] = useState(0);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const redirectFor = (roles: string[] = []) =>
    roles.includes("IT_ADMIN") && !roles.includes("SUPER_ADMIN") ? "/it/dashboard" : "/hr/dashboard";

  const validateEmail = () => {
    if (!email) return "Official email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address";
    return "";
  };

  const pickRole = (role: Role) => {
    setSelectedRole(role);
    setError("");
    setOtpError("");
    setSuccess("");
    if (role === "ADMIN") {
      setStep("email");
      setPassword("");
    }
  };

  const sendOtp = async (e?: FormEvent) => {
    e?.preventDefault();
    setError("");
    setSuccess("");
    setOtpError("");
    const v = validateEmail();
    if (v) return setError(v);
    setLoading(true);
    try {
      await authApi.requestHrOtp(email);
      setSuccess("OTP sent successfully to your email");
      setStep("otp");
      setOtp(Array(6).fill(""));
      setTimer(30);
      setTimeout(() => inputsRef.current[0]?.focus(), 100);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    setOtpError("");
    if (value && index < 5) inputsRef.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) inputsRef.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = Array(6).fill("");
    text.split("").forEach((ch, i) => {
      next[i] = ch;
    });
    setOtp(next);
    inputsRef.current[Math.min(text.length, 5)]?.focus();
  };

  const verifyOtp = async () => {
    setOtpError("");
    const code = otp.join("");
    if (code.length !== 6) return setOtpError("Please enter the 6-digit OTP.");
    setVerifyLoading(true);
    try {
      const r = await authApi.verifyHrOtp(email, code);
      login(r.data.user);
      navigate(redirectFor(r.data.user?.roles));
    } catch (err: any) {
      setOtpError(err?.response?.data?.error?.message || "Invalid or expired OTP. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const resendOtp = async () => {
    if (timer > 0 || resendLoading) return;
    setOtpError("");
    setResendLoading(true);
    try {
      await authApi.requestHrOtp(email);
      setSuccess("OTP sent successfully to your email");
      setOtp(Array(6).fill(""));
      setTimer(30);
      inputsRef.current[0]?.focus();
    } catch (err: any) {
      setOtpError(err?.response?.data?.error?.message || "Failed to resend OTP. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  const loginWithPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) return setError("Administrator email is required");
    if (!password) return setError("Password is required");
    setLoading(true);
    try {
      const r = await authApi.passwordLogin(email, password);
      login(r.data.user);
      navigate(redirectFor(r.data.user?.roles));
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const otpSent = step === "otp";

  return (
    <div className="min-h-screen bg-[#f6f8f2] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-6">
          <img
            src="/assets/ecometrix-logo.png"
            alt="Ecometrix logo"
            className="mx-auto w-[150px] h-auto object-contain"
          />
          <p className="mt-3 text-sm font-medium text-gray-700">Ecometrix Consultants Pvt. Ltd.</p>
        </div>

        {/* Card */}
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
              <p className="mt-1 text-sm text-gray-500">
                {selectedRole === "ADMIN"
                  ? "Use the admin password to access the system."
                  : "Use your official email ID with OTP to access the system."}
              </p>

              <div className="mt-5 space-y-4">
                {/* Login As */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Login As</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => pickRole("ADMIN")}
                      disabled={otpSent}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                        selectedRole === "ADMIN"
                          ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      } disabled:opacity-60`}
                    >
                      Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => pickRole("HR")}
                      disabled={otpSent}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                        selectedRole === "HR"
                          ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      } disabled:opacity-60`}
                    >
                      HR
                    </button>
                  </div>
                </div>

                {selectedRole === "ADMIN" ? (
                  <form onSubmit={loginWithPassword} className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Administrator Email</label>
                      <div className="relative">
                        <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-600" />
                        <input
                          type="email"
                          name="email"
                          autoComplete="username"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="it.admin@emc.example"
                          className={`w-full rounded-xl border bg-white pl-10 pr-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ${
                            error ? "border-red-400 focus:ring-red-500 focus:border-red-500" : "border-gray-300"
                          }`}
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
                          className={`w-full rounded-xl border bg-white pl-10 pr-10 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ${
                            error ? "border-red-400 focus:ring-red-500 focus:border-red-500" : "border-gray-300"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-700 hover:text-brand-800"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
                    </div>
                    <button type="submit" disabled={loading} className="w-full btn-primary">
                      <Shield size={18} />
                      {loading ? "Signing in..." : "Sign In"}
                    </button>
                  </form>
                ) : (
                  <>
                    <form onSubmit={sendOtp} className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">Official Email ID</label>
                        <div className="relative">
                          <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-600" />
                          <input
                            type="email"
                            name="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="hr@emc.example"
                            disabled={otpSent}
                            className={`w-full rounded-xl border bg-white pl-10 pr-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-50 ${
                              error ? "border-red-400 focus:ring-red-500 focus:border-red-500" : "border-gray-300"
                            }`}
                          />
                        </div>
                        {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
                      </div>
                      {!otpSent && (
                        <button type="submit" disabled={loading} className="w-full btn-primary">
                          <Shield size={18} />
                          {loading ? "Sending OTP..." : "Send OTP"}
                        </button>
                      )}
                    </form>

                    {otpSent && (
                      <div className="mt-4 space-y-4">
                        {success && <p className="text-sm text-brand-700 font-medium text-center">{success}</p>}
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700 text-center">
                            Enter 6-digit OTP
                          </label>
                          <div className="flex justify-center gap-2 flex-wrap" onPaste={handleOtpPaste}>
                            {otp.map((digit, i) => (
                              <input
                                key={i}
                                ref={(el) => {
                                  inputsRef.current[i] = el;
                                }}
                                value={digit}
                                onChange={(e) => handleOtpChange(i, e.target.value)}
                                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                inputMode="numeric"
                                maxLength={1}
                                aria-label={`OTP digit ${i + 1}`}
                                className="w-10 h-11 sm:w-11 sm:h-12 text-center text-lg font-semibold text-gray-900 caret-gray-900 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                              />
                            ))}
                          </div>
                          {otpError && <p className="mt-2 text-sm text-red-600 text-center">{otpError}</p>}
                        </div>
                        <button type="button" onClick={verifyOtp} disabled={verifyLoading} className="w-full btn-primary">
                          {verifyLoading ? "Verifying..." : "Verify OTP"}
                        </button>
                        <div className="text-center">
                          <button
                            type="button"
                            onClick={resendOtp}
                            disabled={timer > 0 || resendLoading}
                            className="text-sm text-brand-800 font-medium hover:underline disabled:text-gray-400 disabled:no-underline"
                          >
                            {resendLoading
                              ? "Resending..."
                              : timer > 0
                              ? `Resend OTP in ${timer}s`
                              : "Resend OTP"}
                          </button>
                        </div>
                        <div className="text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setStep("email");
                              setSuccess("");
                              setOtpError("");
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
                          >
                            Change email address
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          <a href="/career" className="hover:text-gray-700 hover:underline">← Back to careers site</a>
          <span className="mx-2">·</span>© 2026 Ecometrix Consultants Pvt. Ltd. All rights reserved.
        </p>
      </div>
    </div>
  );
}
