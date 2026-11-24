import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../style/Login.css";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

const DEMO_USER = "xyz";          
const AFTER_LOGIN = "/dashboard"; 

export default function Login() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1); 
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(""));
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const inputs = useRef([]);

    useEffect(() => {
        if (seconds <= 0) return;
        const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
        return () => clearTimeout(t);
    }, [seconds]);

    useEffect(() => {
        if (step === 2) inputs.current[0]?.focus();
    }, [step]);

    const sendOtp = async () => {
        setLoading(true);
        try {
            await new Promise((r) => setTimeout(r, 600));
            setSeconds(RESEND_SECONDS);
            return true;
        } finally {
            setLoading(false);
        }
    };

    const handleEmail = async (e) => {
        e.preventDefault();

        if (email.trim().toLowerCase() === DEMO_USER) {
            localStorage.setItem("emc_auth", "true");
            localStorage.setItem("emc_user", email.trim());
            navigate(AFTER_LOGIN);
            return;
        }

        if (!/^\S+@\S+\.\S+$/.test(email)) {
            setError("Enter a valid work email, like name@company.com.");
            return;
        }
        setError("");
        if (await sendOtp()) setStep(2);
    };

    const handleOtpChange = (i, val) => {
        if (!/^\d?$/.test(val)) return;
        const next = [...otp];
        next[i] = val;
        setOtp(next);
        if (val && i < OTP_LENGTH - 1) inputs.current[i + 1]?.focus();
    };

    const handleOtpKey = (i, e) => {
        if (e.key === "Backspace" && !otp[i] && i > 0) inputs.current[i - 1]?.focus();
        if (e.key === "ArrowLeft" && i > 0) inputs.current[i - 1]?.focus();
        if (e.key === "ArrowRight" && i < OTP_LENGTH - 1) inputs.current[i + 1]?.focus();
    };

    const handlePaste = (e) => {
        const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
        if (!digits) return;
        e.preventDefault();
        const next = Array(OTP_LENGTH).fill("");
        digits.split("").forEach((d, i) => (next[i] = d));
        setOtp(next);
        inputs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        const code = otp.join("");
        if (code.length < OTP_LENGTH) {
            setError("Enter all 6 digits from your Zoho Authenticator app.");
            return;
        }
        setError("");
        setLoading(true);
        await new Promise((r) => setTimeout(r, 600));
        setLoading(false);
        localStorage.setItem("emc_auth", "true");
        localStorage.setItem("emc_user", email.trim());
        navigate(AFTER_LOGIN);
    };

    const goBack = () => {
        setStep(1);
        setOtp(Array(OTP_LENGTH).fill(""));
        setError("");
    };

    return (
        <main className="lg-page">
            <div className="lg-shell">
                <section className="lg-hero" aria-label="About EMC">
                    <ClarifierArt />
                    <header className="lg-hero-top">
                        <img
                            src="/Image/img1.png"
                            alt="Ecometrix Logo"
                            className="lg-logo"
                        />
                    </header>
                    <div className="lg-hero-copy">
                        <h1>
                            End-to-End
                            <br />
                            Engineering <span className="lg-green">Solutions</span>
                        </h1>
                        <p>
                            Building a sustainable tomorrow through innovative engineering and
                            technology.
                        </p>
                    </div>

                    <ul className="lg-points">
                        <li>
                            <ShieldIcon />
                            <div>
                                <strong>Secure</strong>
                                <span>Enterprise-grade security</span>
                            </div>
                        </li>
                        <li>
                            <PhoneIcon />
                            <div>
                                <strong>Password-less</strong>
                                <span>Sign in with Zoho Authenticator</span>
                            </div>
                        </li>
                        <li>
                            <ClockIcon />
                            <div>
                                <strong>One-time codes</strong>
                                <span>Short-lived, secure access</span>
                            </div>
                        </li>
                    </ul>
                </section> 
                <section className="lg-panel">
                    <div className="lg-form-wrap">
                        <div className="lg-panel-logo">
                            <Logo />
                        </div>
                        <h2>Welcome to EMCOne</h2>
                        <p className="lg-sub">Secure access to your workspace</p>
                        <ol className="lg-steps" aria-label="Sign-in progress">
                            <li className={step >= 1 ? "is-on" : ""} aria-current={step === 1 ? "step" : undefined}>
                                <i />
                                Enter email
                            </li>
                            <li className={step >= 2 ? "is-on" : ""} aria-current={step === 2 ? "step" : undefined}>
                                <i />
                                Verify with OTP
                            </li>
                        </ol>

                        {step === 1 ? (
                            <form onSubmit={handleEmail} noValidate key="email">
                                <h3>Enter your work email</h3>
                                <p className="lg-hint">
                                    We'll send a one-time password (OTP) to your Zoho Authenticator app.
                                </p>

                                <label htmlFor="lg-email">Work email</label>
                                <div className={`lg-field ${error ? "has-error" : ""}`}>
                                    <UserIcon />
                                    <input
                                        id="lg-email"
                                        type="text"
                                        placeholder="name@yourcompany.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        autoComplete="email"
                                        autoFocus
                                        aria-invalid={!!error}
                                        aria-describedby={error ? "lg-error" : undefined}
                                    />
                                </div>
                                {error && (
                                    <p className="lg-error" id="lg-error" role="alert">
                                        {error}
                                    </p>
                                )}

                                <button type="submit" className="lg-btn" disabled={loading}>
                                    {loading ? <span className="lg-spin" aria-hidden="true" /> : null}
                                    {loading ? "Sending code" : "Continue"}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleVerify} noValidate key="otp">
                                <h3>Enter your 6-digit code</h3>
                                <p className="lg-hint">
                                    Open Zoho Authenticator and enter the code for <b>{email}</b>.
                                </p>

                                <div className="lg-otp" onPaste={handlePaste}>
                                    {otp.map((d, i) => (
                                        <input
                                            key={i}
                                            ref={(el) => (inputs.current[i] = el)}
                                            value={d}
                                            inputMode="numeric"
                                            autoComplete={i === 0 ? "one-time-code" : "off"}
                                            maxLength={1}
                                            aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
                                            className={error ? "has-error" : ""}
                                            onChange={(e) => handleOtpChange(i, e.target.value)}
                                            onKeyDown={(e) => handleOtpKey(i, e)}
                                        />
                                    ))}
                                </div>
                                {error && (
                                    <p className="lg-error" role="alert">
                                        {error}
                                    </p>
                                )}

                                <button type="submit" className="lg-btn" disabled={loading}>
                                    {loading ? <span className="lg-spin" aria-hidden="true" /> : null}
                                    {loading ? "Verifying" : "Verify and sign in"}
                                </button>

                                <div className="lg-row">
                                    <button type="button" className="lg-link" onClick={goBack}>
                                        Use a different email
                                    </button>
                                    <button
                                        type="button"
                                        className="lg-link"
                                        disabled={seconds > 0 || loading}
                                        onClick={sendOtp}
                                    >
                                        {seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}
                                    </button>
                                </div>
                            </form>
                        )}

                        <div className="lg-note">
                            <ShieldIcon />
                            <p>
                                Password-less sign-in powered by <b>Zoho Authenticator</b>
                            </p>
                        </div>

                        <p className="lg-help">
                            Need help? <a href="mailto:it-support@yourcompany.com">Contact IT Support</a>
                        </p>
                    </div>
                </section>
            </div>
        </main>
    );
}

function Logo() {
    return (
        <img
            src="/Image/img1.png"
            alt="EMC Logo"
            className="emc-logo"
        />
    );
}

function ClarifierArt() {
    const spokes = Array.from({ length: 36 }, (_, i) => i * 10);
    return (
        <svg className="lg-art" viewBox="0 0 600 600" aria-hidden="true">
            <circle cx="300" cy="300" r="290" className="art-rim" />
            <circle cx="300" cy="300" r="262" className="art-water" />
            <circle cx="300" cy="300" r="190" className="art-ring" />
            <circle cx="300" cy="300" r="120" className="art-ring" />
            <g className="art-spokes">
                {spokes.map((a) => (
                    <line key={a} x1="300" y1="300" x2="300" y2="40" transform={`rotate(${a} 300 300)`} />
                ))}
            </g>
            <g className="art-sweep">
                <rect x="294" y="34" width="12" height="266" rx="3" />
                <path d="M300 300 L300 38 A262 262 0 0 1 430 73 Z" className="art-beam" />
            </g>
            <circle cx="300" cy="300" r="38" className="art-hub" />
            <circle cx="300" cy="300" r="14" className="art-hub-core" />
        </svg>
    );
}

const ip = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
};

function ShieldIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" {...ip} aria-hidden="true">
            <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
            <path d="M8.5 12l2.5 2.5L15.5 10" />
        </svg>
    );
}
function PhoneIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" {...ip} aria-hidden="true">
            <rect x="6" y="2" width="12" height="20" rx="2" />
            <path d="M10 18h4M9.5 9.5l2 2 3-3.5" />
        </svg>
    );
}
function ClockIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" {...ip} aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
        </svg>
    );
}
function UserIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" {...ip} aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </svg>
    );
}