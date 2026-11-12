import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../lib/api";
import Logo from "../../components/Logo";

type Mode = "otp" | "password";

export default function HRLogin() {
  const [mode, setMode] = useState<Mode>("otp");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [passwordAvailable, setPasswordAvailable] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const sendOtp = async () => {
    setLoading(true);
    setError("");
    try {
      await authApi.requestHrOtp(email);
      setStep("otp");
      authApi.passwordAvailable?.(email);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const requestOtp = async (e: FormEvent) => {
    e.preventDefault();
    await sendOtp();
  };

  const redirectFor = (roles: string[] = []) =>
    roles.includes("IT_ADMIN") && !roles.includes("SUPER_ADMIN") ? "/it/dashboard" : "/hr/dashboard";

  const verifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await authApi.verifyHrOtp(email, code);
      login(r.data.user);
      navigate(redirectFor(r.data.user?.roles));
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Invalid OTP code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const loginWithPassword = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await authApi.passwordLogin(email, password);
      login(r.data.user);
      navigate(redirectFor(r.data.user?.roles));
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const checkPassword = async () => {
    try {
      const r = await authApi.passwordAvailable(email);
      setPasswordAvailable(Boolean(r.data.available));
    } catch {
      setPasswordAvailable(false);
    }
  };

  return (
    <div className="min-h-screen surface-app flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-[#198754]/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-24 w-[380px] h-[380px] rounded-full bg-[#F28C28]/10 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-[440px]">
        {/* Brand */}
        <div className="flex flex-col items-center mb-6">
          <div className="rounded-2xl shadow-lg overflow-hidden bg-black p-2">
            <Logo size={52} />
          </div>
          <h1 className="mt-4 text-xl font-extrabold ink-body tracking-tight">
            EMC<span className="text-[#F28C28]">.</span> Talent Acquisition Portal
          </h1>
          <p className="text-sm ink-soft mt-1 text-center">
            HR Management System · Sign in to continue
          </p>
        </div>

        {/* Card */}
        <div className="card p-6 sm:p-7 shadow-card">
          {/* Mode switch */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#171717]/5 mb-6">
            {([
              { key: "otp", label: "Email OTP" },
              { key: "password", label: "Password" },
            ] as const).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => { setMode(m.key); setError(""); setStep("email"); }}
                className={`py-2 rounded-lg text-sm font-semibold transition-all ${
                  mode === m.key
                    ? "surface-card ink-body shadow-sm"
                    : "ink-soft hover:ink-body"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === "otp" ? (
            step === "email" ? (
              <form onSubmit={requestOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold ink-soft mb-1.5">Official HR Email ID</label>
                  <input
                    className="input"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={checkPassword}
                    placeholder="hr@emc.example"
                  />
                </div>
                <button className="btn-primary w-full py-3" disabled={loading}>
                  {loading ? "Sending OTP…" : "Send OTP"}
                </button>
                <p className="text-xs ink-soft text-center">
                  We will send a 6-digit code to your registered email. It expires in 5 minutes.
                </p>
              </form>
            ) : (
              <form onSubmit={verifyOtp} className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm ink-soft">
                    Code sent to <span className="font-semibold ink-body">{email}</span>
                  </p>
                  <button
                     type="button"
                     onClick={() => { setStep("email"); }}
                     className="text-xs font-semibold text-[#198754] hover:underline"
                   >
                     Change
                   </button>
                </div>
                <div>
                  <label className="block text-sm font-semibold ink-soft mb-1.5">6-digit verification code</label>
                  <input
                    className="input text-center text-2xl font-bold tracking-[0.5em] py-3"
                    type="text"
                    required
                    maxLength={6}
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                  />
                </div>
                <button className="btn-primary w-full py-3" disabled={loading}>
                  {loading ? "Verifying…" : "Verify and Login"}
                </button>
                <p className="text-xs ink-soft text-center">
                  Didn&apos;t receive the code?{" "}
                  <button type="button" onClick={sendOtp} disabled={loading} className="font-semibold text-[#198754] hover:underline">
                    Resend OTP
                  </button>
                </p>
              </form>
            )
          ) : (
            <form onSubmit={loginWithPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold ink-soft mb-1.5">Administrator Email</label>
                <input
                  className="input"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={checkPassword}
                  placeholder="it.admin@emc.example"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold ink-soft mb-1.5">Password</label>
                <input
                  className="input"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              {passwordAvailable && (
                <p className="text-xs text-[#198754]">Password sign-in is enabled for this account.</p>
              )}
              <p className="text-xs ink-soft">
                Password sign-in is reserved for the IT administrator, who can reset any HR account.
              </p>
              <button className="btn-primary w-full py-3" disabled={loading}>
                {loading ? "Signing in…" : "Sign in with Password"}
              </button>
            </form>
          )}

          {error && (
            <div className="mt-4 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2.5 text-sm text-orange-800">
              {error}
            </div>
          )}
        </div>

        <div className="mt-5 text-center space-y-1.5">
          <a href="/career" className="inline-block text-sm ink-soft hover:text-[#198754] transition-colors">
            ← Back to careers site
          </a>
          <p className="text-xs ink-soft">Authorized HR accounts only.</p>
        </div>
      </div>
    </div>
  );
}
