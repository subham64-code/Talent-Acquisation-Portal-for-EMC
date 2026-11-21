import { useState, useEffect, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { hrApi } from "../../lib/api";
import { careerSiteUrl } from "../../lib/appLinks";
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

  useEffect(() => {
    if (!token) setError("This offer response link is missing or invalid. Please contact HR.");
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!decision) return;
    setLoading(true); setError("");
    try {
      const r: any = await hrApi.respondOffer({ token, decision, remarks: remarks || undefined });
      setUploadLink(r?.data?.uploadLink || "");
      setStep("success");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Your response could not be recorded. Please contact HR.");
    } finally { setLoading(false); }
  };

  if (step === "success") return (
    <div className="min-h-screen surface-app public-light flex items-center justify-center p-4">
      <div className="card p-8 sm:p-10 mx-auto text-center max-w-md w-full">
        <div className="w-16 h-16 mx-auto rounded-full bg-[#659616] flex items-center justify-center text-white mb-5">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <h2 className="text-2xl font-extrabold ink-body">Response Recorded</h2>
        <p className="ink-soft mt-2">Your offer response ({decision}) has been securely recorded by EMC.</p>
        {decision === "ACCEPTED" && (
          <>
            <p className="text-sm ink-soft mt-5">One last step is required. Upload your onboarding documents through the secure portal below.</p>
            {uploadLink && <a href={uploadLink} className="btn-primary inline-flex w-full justify-center mt-4">Upload Documents Now</a>}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen surface-app public-light">
      <nav className="corporate-header">
        <div className="corporate-header__inner">
          <div className="corporate-logo"><Logo size={46} /></div>
          <div className="corporate-tools"><a href={careerSiteUrl} className="corporate-tool">Open roles</a></div>
        </div>
      </nav>
      <main className="max-w-xl mx-auto px-4 py-10">
        <div className="card p-6 sm:p-8">
          <div className="flex items-center gap-3 pb-4 border-b border-[#dfe7f1]">
            <Logo size={38} />
            <div><h1 className="text-xl sm:text-2xl font-extrabold text-[#111a30]">Offer Response</h1><p className="text-xs text-[#6f7b98]">Confirm your employment decision</p></div>
          </div>
          <p className="text-sm text-[#374151] my-5">Review the offer carefully and select one option. The response is recorded in the EMC recruitment system.</p>
          <form onSubmit={submit} className="space-y-5">
            <fieldset>
              <legend className="text-sm font-bold text-[#111a30] mb-2">Your decision</legend>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" className={`btn px-4 py-3 rounded-xl border text-sm font-extrabold ${decision === "ACCEPTED" ? "bg-[#659616] text-white border-[#659616]" : "bg-white text-[#111a30] border-[#dfe7f1] hover:border-[#659616]"}`} onClick={() => setDecision("ACCEPTED")}>Accept</button>
                <button type="button" className={`btn px-4 py-3 rounded-xl border text-sm font-extrabold ${decision === "DECLINED" ? "bg-[#E5810A] text-white border-[#E5810A]" : "bg-white text-[#111a30] border-[#dfe7f1] hover:border-[#E5810A]"}`} onClick={() => setDecision("DECLINED")}>Decline</button>
              </div>
            </fieldset>
            <label className="flex flex-col gap-1.5 text-sm font-bold text-[#111a30]">Optional remarks<textarea className="input" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Add a note for HR (optional)" /></label>
            <button className="btn-primary w-full py-3" disabled={loading || !decision || !token}>{loading ? "Saving…" : "Submit Response"}</button>
          </form>
          {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-100">{error}</div>}
        </div>
      </main>
    </div>
  );
}
