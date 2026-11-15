import { useEffect, useState } from "react";
import { X, LifeBuoy, Mail, Copy, Check, ShieldCheck, Camera, UserCheck, Clock3, AlertCircle } from "lucide-react";

const SUPPORT_EMAIL =
  (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) || "subhambehera2023@gift.edu.in";

export default function HelpSupportModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = SUPPORT_EMAIL;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Help and support"
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--card)] shadow-2xl animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-5 py-4 bg-gradient-to-br from-[var(--green-dark)] via-[var(--green-mid)] to-[var(--green)] text-white">
          <button
            onClick={onClose}
            aria-label="Close help"
            className="absolute top-3 right-3 p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <LifeBuoy size={22} />
            </span>
            <span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-white/80">EMC Talent Acquisition Portal</span>
              <span className="block text-lg font-extrabold tracking-tight leading-tight">Help &amp; Support</span>
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="text-sm text-[var(--ink-soft)] leading-relaxed">
            Have a question, found a bug, or need access changed? Write to the portal administrator —
            any query about the HR system is handled here.
          </p>

          {/* Contact card */}
          <div className="mt-4 rounded-xl border border-[var(--green-line)] bg-[var(--green-softer)] p-4">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-full bg-[var(--green-mid)] text-white flex items-center justify-center font-bold text-sm shrink-0">
                A
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-[var(--ink)] leading-tight">Portal Administrator</span>
                <span className="block text-[11px] text-[var(--muted)] mt-0.5">IT Administrator · HR Super Admin</span>
              </span>
              <ShieldCheck size={20} className="ml-auto text-[var(--green-mid)] shrink-0" />
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] pl-3 pr-2 py-2">
              <Mail size={16} className="text-[var(--green-mid)] shrink-0" />
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-[13px] font-semibold text-[var(--green-dark)] hover:underline truncate"
                title={SUPPORT_EMAIL}
              >
                {SUPPORT_EMAIL}
              </a>
              <button
                onClick={copyEmail}
                className="ml-auto p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--card-soft)] transition-colors shrink-0"
                title={copied ? "Copied!" : "Copy email address"}
                aria-label="Copy email address"
              >
                {copied ? <Check size={16} className="text-[var(--green-mid)]" /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          {/* CTAs */}
          <div className="mt-4 flex gap-2">
            <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("EMC Portal — Support Request")}`} className="btn-primary flex-1">
              <Mail size={16} /> Email support
            </a>
            <button onClick={copyEmail} className="btn-outline">
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          {/* Checklist */}
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card-soft)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)] mb-2">
              Include in your mail (speeds up resolution)
            </p>
            <ul className="space-y-1.5 text-xs text-[var(--ink-soft)]">
              <li className="flex items-start gap-2"><UserCheck size={13} className="mt-0.5 shrink-0 text-[var(--green-mid)]" />Your registered official email and role</li>
              <li className="flex items-start gap-2"><Camera size={13} className="mt-0.5 shrink-0 text-[var(--green-mid)]" />A screenshot of the error or the page you were on</li>
              <li className="flex items-start gap-2"><Clock3 size={13} className="mt-0.5 shrink-0 text-[var(--green-mid)]" />Date &amp; time when the issue happened</li>
              <li className="flex items-start gap-2"><AlertCircle size={13} className="mt-0.5 shrink-0 text-[var(--green-mid)]" />What you expected vs. what you saw</li>
            </ul>
          </div>

          <p className="mt-3 text-[10px] text-center text-[var(--muted)]">
            Typical response time: within one working day. For urgent access issues, contact the HR department directly.
          </p>
        </div>
      </div>
    </div>
  );
}
