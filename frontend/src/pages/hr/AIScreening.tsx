import { useEffect, useState, Fragment } from "react";
import { hrApi } from "../../lib/api";

const STATUS_TONE: Record<string, string> = {
  SHORTLISTED: "border-[#659616]/30 bg-[#659616]/10 text-[#659616]/80",
  SELECTED: "border-[#659616]/30 bg-[#659616]/10 text-[#659616]/80",
  HIRED: "border-[#659616]/30 bg-[#659616]/10 text-[#659616]/80",
  ON_HOLD: "border-[#FF9412]/30 bg-[#FF9412]/10 text-[#FF9412]/80",
  REJECTED: "border-[#171717]/15 bg-[#171717]/5 ink-soft",
};

function scoreTone(score: number) {
  if (score >= 75) return "text-[#659616]";
  if (score >= 50) return "text-[#FF9412]";
  return "ink-soft";
}

export default function AIScreening() {
  const [openings, setOpenings] = useState<any[]>([]);
  const [selected, setSelected] = useState("");
  const [matches, setMatches] = useState<any[]>([]);
  const [runInfo, setRunInfo] = useState<any>(null);
  const [minScore, setMinScore] = useState("");
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    hrApi.openings({ page: 1, pageSize: 100, status: "PUBLISHED" })
      .then((r: any) => setOpenings(r.data.items ?? r.data))
      .catch(() => setOpenings([]));
  }, []);

  const loadMatches = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const r = await hrApi.aiRanked(selected, { page: 1, pageSize: 50, minScore: minScore || undefined });
      setMatches(r.data.items ?? []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not load AI rankings.");
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMatches(); }, [selected, minScore]);

  const run = async () => {
    if (!selected) { setError("Please select a job opening first."); return; }
    setRunning(true);
    setError("");
    try {
      const r = await hrApi.aiRun({ jobOpeningId: selected });
      setRunInfo(r.data.run);
      await loadMatches();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "AI screening failed. Make sure candidates have skills or an uploaded CV.");
    } finally {
      setRunning(false);
    }
  };

  const act = async (applicationId: string, action: "shortlist" | "hold") => {
    try {
      const remarks = action === "hold" ? window.prompt("Reason for placing on hold:", "Further review required") : undefined;
      await hrApi.aiAction(applicationId, { action, remarks: remarks ?? undefined });
      await loadMatches();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Action failed.");
    }
  };

  const viewCV = async (fileId: string) => {
    try {
      const r = await hrApi.fileAccessToken(fileId);
      window.open(r.data.url, "_blank");
    } catch { setError("Could not open the CV."); }
  };

  const job = openings.find((o: any) => o.id === selected);

  return (
    <div className="min-h-screen surface-app p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold ink-body tracking-tight">AI Screening</h1>
          <p className="text-sm ink-soft mt-0.5">
            Rank candidates against a vacancy using transparent, weighted scoring. HR makes the final decision.
          </p>
        </div>
        {runInfo && (
          <div className="flex gap-3 text-xs">
            <span className="badge border-[#659616]/30 bg-[#659616]/10 text-[#659616]/80">
              {runInfo.candidatesEvaluated} evaluated
            </span>
            <span className="badge border-[#FF9412]/30 bg-[#FF9412]/10 text-[#FF9412]/80">
              Top score {runInfo.topScore != null ? Math.round(runInfo.topScore) : "—"}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-5 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError("")} className="font-bold">×</button>
        </div>
      )}

      {/* Controls */}
      <div className="card p-5 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-3 items-end">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold ink-soft">Job opening</label>
            <select className="input" value={selected} onChange={(e) => { setSelected(e.target.value); setRunInfo(null); }}>
              <option value="">Select a vacancy to screen…</option>
              {openings.map((o: any) => (
                <option key={o.id} value={o.id}>
                  {o.jobCode} — {o.title} ({o.department?.name})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold ink-soft">Minimum match score</label>
            <input className="input" type="number" value={minScore} onChange={(e) => setMinScore(e.target.value)} placeholder="e.g. 60" />
          </div>
          <button className="btn-primary py-2.5" onClick={run} disabled={running || !selected}>
            {running ? "Screening…" : "Run AI Screening"}
          </button>
        </div>
        {job && (
          <div className="mt-4 pt-4 border-t border-[#171717]/10 flex flex-wrap gap-2 text-xs">
            <span className="ink-soft">Required skills:</span>
            {(job.requiredSkills || []).map((s: string) => (
              <span key={s} className="px-2 py-0.5 rounded bg-[#FF9412]/10 text-[#FF9412] font-semibold">{s}</span>
            ))}
            <span className="ml-auto ink-soft">Min {job.minExperience}–{job.maxExperience} yrs</span>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#171717]/10 flex items-center justify-between">
          <h3 className="font-bold ink-body">Ranked Candidates</h3>
          <span className="text-xs ink-soft">{matches.length} result(s)</span>
        </div>
        {loading ? (
          <div className="h-64 flex items-center justify-center ink-soft">Loading rankings…</div>
        ) : matches.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="ink-soft mb-1">No candidates ranked yet.</p>
            <p className="text-xs ink-soft">Select an opening and run AI screening to populate this list.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th><th>Candidate</th><th>Qualification</th><th>Experience</th>
                  <th>Matched Skills</th><th>Missing</th><th>Score</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m: any, i: number) => (
                  <Fragment key={m.id ?? i}>
                    <tr className="align-top">
                      <td className="ink-soft">{i + 1}</td>
                      <td>
                        <div className="font-medium ink-body">{m.candidate?.fullName}</div>
                        <div className="text-xs ink-soft">{m.candidate?.email}</div>
                        <button className="text-[11px] text-[#659616] font-semibold mt-0.5" onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
                          {expanded === m.id ? "Hide details" : "Why this score?"}
                        </button>
                        {expanded === m.id && (
                          <div className="mt-2 p-3 rounded-lg bg-[#171717]/[0.03] border border-[#171717]/8 text-xs space-y-2">
                            <p className="font-semibold ink-body">Explanation</p>
                            <p className="ink-soft leading-relaxed">{m.explanation}</p>
                            <div className="grid grid-cols-2 gap-1.5 pt-1">
                              <div className="flex justify-between"><span>Skills</span><span className="font-bold">{Math.round(m.skillScore)}</span></div>
                              <div className="flex justify-between"><span>Experience</span><span className="font-bold">{Math.round(m.experienceScore)}</span></div>
                              <div className="flex justify-between"><span>Qualification</span><span className="font-bold">{Math.round(m.qualificationScore)}</span></div>
                              <div className="flex justify-between"><span>Domain</span><span className="font-bold">{Math.round(m.domainScore)}</span></div>
                              <div className="flex justify-between"><span>Certifications</span><span className="font-bold">{Math.round(m.certificationScore)}</span></div>
                              <div className="flex justify-between"><span>CV confidence</span><span className="font-bold">{m.extractionConfidence != null ? Math.round(m.extractionConfidence) : "—"}</span></div>
                            </div>
                            {Array.isArray(m.strengths) && m.strengths.length > 0 && (
                              <p className="text-[#659616]">+ {m.strengths.join(" · ")}</p>
                            )}
                            {Array.isArray(m.gaps) && m.gaps.length > 0 && (
                              <p className="text-[#E5810A]">− {m.gaps.join(" · ")}</p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="ink-soft">{m.candidate?.qualification || "—"}</td>
                      <td className="ink-soft">
                        {m.candidate?.totalExperience ?? "—"} yrs
                        <span className="block text-[11px] ink-soft">rel. {m.candidate?.relevantExperience ?? "—"}</span>
                      </td>
                      <td className="text-xs text-[#659616] max-w-[180px]">
                        {Array.isArray(m.matchedSkills) && m.matchedSkills.length
                          ? m.matchedSkills.join(", ")
                          : <span className="ink-soft">none</span>}
                      </td>
                      <td className="text-xs text-[#E5810A] max-w-[150px]">
                        {Array.isArray(m.missingSkills) && m.missingSkills.length
                          ? m.missingSkills.join(", ")
                          : <span className="ink-soft">—</span>}
                      </td>
                      <td>
                        <span className={`text-lg font-extrabold ${scoreTone(m.overallScore)}`}>
                          {Math.round(m.overallScore)}
                        </span>
                        <span className="text-[10px] ink-soft block">overall</span>
                      </td>
                      <td>
                        <span className={`badge ${STATUS_TONE[m.application?.status] || "border-[#171717]/15 bg-[#171717]/5 ink-soft"}`}>
                          {String(m.application?.status || "APPLIED").replace(/_/g, " ")}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <button className="btn-xs btn-outline whitespace-nowrap" onClick={() => act(m.applicationId, "shortlist")} disabled={!m.applicationId}>Shortlist</button>
                          <button className="btn-xs btn-outline whitespace-nowrap" onClick={() => act(m.applicationId, "hold")} disabled={!m.applicationId}>Hold</button>
                          {m.candidate?.cvFileId && (
                            <button className="btn-xs btn-ghost whitespace-nowrap" onClick={() => viewCV(m.candidate.cvFileId)}>View CV</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
