import { useState, useEffect, type FormEvent } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { hrApi } from "../../lib/api";
import Logo from "../../components/Logo";

export default function OfferRespond() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [step, setStep] = useState<"form" | "success">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState<"ACCEPTED" | "DECLINED" | null>(null);
  const [remarks, setRemarks] = useState("");
  const [uploadLink, setUploadLink] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) setError("No response token provided.");
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const r: any = await hrApi.respondOffer({ token, decision: decision!, remarks: remarks || undefined });
      setUploadLink(r?.data?.uploadLink || "");
      setStep("success");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Response failed.");
    } finally { setLoading(false); }
  };

  if (step === "success") return (
    <div className="min-h-screen flex items-center center surface-app">
      <div className="card p-8 mx-auto text-center max-w-md">
        <div className="w-10 h-10 rounded-full bg-[#198754] flex items-center justify-center text-white mx-auto mb-4 font-bold">✓</div>
        <h2 className="text-xl font-bold ink-body mb-2">Response Recorded</h2>
        <p className="ink-soft mb-6">Your offer response ({decision}) has been recorded.</p>
        {decision === "ACCEPTED" && uploadLink ? (
          <>
            <p className="text-sm ink-soft mb-4">One last step — upload your onboarding documents through the secure portal. A link has also been sent to your email.</p>
            <a href={uploadLink} className="btn-primary inline-flex w-full justify-center mb-3">Upload Documents Now</a>
          </>
        ) : null}
        <button className="btn-ghost" onClick={() => navigate("/")}>Return to Careers</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen surface-app">
      <div className="max-w-md mx-auto p-4">
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Logo size={34} />
            <div className="text-xl font-bold ink-body">Offer Response</div>
          </div>
          <p className="ink-soft text-sm mb-6">Please review and respond to your offer.</p>
          <form onSubmit={submit} className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium ink-soft">Decision</label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" className={`btn px-4 py-2 rounded-lg border text-sm font-medium ${decision === "ACCEPTED" ? "bg-[#198754] text-white border-[#198754]" : "surface-card ink-body line-border hover:bg-[#198754]/10"}`} onClick={() => setDecision("ACCEPTED")}>Accept</button>
                <button type="button" className={`btn px-4 py-2 rounded-lg border text-sm font-medium ${decision === "DECLINED" ? "bg-[#D97417] text-white border-[#D97417]" : "surface-card ink-body line-border hover:bg-orange-50"}`} onClick={() => setDecision("DECLINED")}>Decline</button>
              </div>
              <input type="hidden" name="decision" value={decision || ""} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium ink-soft">Remarks</label>
              <textarea className="input" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional remarks" />
            </div>
            <button className="btn-primary w-full" disabled={loading || !decision}>{loading ? "Submitting…" : "Submit Response"}</button>
          </form>
          {error && <div className="rounded bg-orange-50 p-3 text-sm text-orange-700 border border-orange-100">{error}</div>}
        </div>
      </div>
    </div>
  );
}
