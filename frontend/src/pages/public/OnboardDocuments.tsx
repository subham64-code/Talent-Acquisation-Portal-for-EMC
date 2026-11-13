import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { api } from "../../lib/api";
import Logo from "../../components/Logo";

const STATUS_STYLE: Record<string, string> = {
  NOT_UPLOADED: "border-[#171717]/15 bg-[#171717]/5 ink-soft",
  UPLOADED: "border-[#198754]/30 bg-[#198754]/10 text-[#198754]/80",
  UNDER_REVIEW: "border-[#8BC34A]/40 bg-[#8BC34A]/10 text-[#5E8C31]",
  ACCEPTED: "border-[#198754]/30 bg-[#198754]/10 text-[#198754]/80",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
  REUPLOAD_REQUIRED: "border-orange-200 bg-orange-50 text-orange-800",
};
const STATUS_LABEL: Record<string, string> = {
  NOT_UPLOADED: "Not uploaded", UPLOADED: "Uploaded — pending review", UNDER_REVIEW: "Under review",
  ACCEPTED: "Accepted", REJECTED: "Rejected", REUPLOAD_REQUIRED: "Re-upload requested",
};

export default function OnboardDocuments() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState<Record<string, number>>({});
  const [doneIds, setDoneIds] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    if (!token) { setError("No document upload token provided. Please use the link from your email."); setLoading(false); return; }
    setLoading(true);
    api.get(`/documents/portal/${token}`)
      .then((r: any) => setData(r?.data ?? r))
      .catch((err: any) => setError(err?.response?.data?.error?.message || "This document link is invalid or has expired."))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const upload = async (categoryId: string, file: File | null | undefined) => {
    if (!file) return;
    setError("");
    const fd = new FormData();
    fd.append("categoryId", categoryId);
    fd.append("file", file);
    setUploading((p) => ({ ...p, [categoryId]: 0 }));
    try {
      const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "/api/v1";
      await axios.post(`${base}/documents/upload/${token}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (e.total != null) setUploading((p) => ({ ...p, [categoryId]: Math.round((e.loaded / e.total!) * 100) }));
        },
      });
      setDoneIds((p) => ({ ...p, [categoryId]: file.name }));
      setUploading((p) => { const n = { ...p }; delete n[categoryId]; return n; });
      load();
    } catch (err: any) {
      setUploading((p) => { const n = { ...p }; delete n[categoryId]; return n; });
      setError(err?.response?.data?.error?.message || "Upload failed. Please try again.");
    }
  };

  const docs: any[] = data?.documents ?? [];
  const required = docs.filter((d) => d.category?.isRequired);
  const allRequiredUploaded = required.length > 0 && required.every((d) => d.status !== "NOT_UPLOADED" && d.status !== "REUPLOAD_REQUIRED");
  const progress = docs.length ? Math.round((docs.filter((d) => d.status !== "NOT_UPLOADED").length / docs.length) * 100) : 0;

  if (loading) return <div className="min-h-screen flex items-center justify-center surface-app public-light ink-soft">Opening your secure document portal…</div>;
  if (error && !data) return (
    <div className="min-h-screen surface-app public-light flex items-center justify-center p-6">
      <div className="card p-8 max-w-md text-center">
        <p className="text-4xl mb-4">🔒</p>
        <h1 className="text-lg font-bold ink-body mb-2">Link not valid</h1>
        <p className="ink-soft text-sm">{error}</p>
        <Link to="/career" className="btn-primary mt-5 inline-flex">Back to Careers</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen surface-app public-light">
      <nav className="surface-ink border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-2">
          <Logo size={30} />
          <span className="font-bold text-white">EMC<span className="text-[#F28C28]">.</span> Onboarding</span>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="card p-5 sm:p-6 mb-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#F28C28] font-bold">Secure document portal</p>
          <h1 className="text-2xl font-extrabold ink-body mt-1">Upload your onboarding documents</h1>
          <p className="text-sm ink-soft mt-1">
            {data?.application?.candidateName} · {data?.application?.jobTitle}{data?.application?.department ? ` · ${data.application.department}` : ""} · App ID <span className="font-mono font-semibold">{data?.application?.applicationCode}</span>
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 rounded-full bg-[#171717]/10 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#2BA56D] to-[#198754] transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs font-bold text-[#198754] tabular-nums">{progress}%</span>
          </div>
          {allRequiredUploaded && (
            <div className="mt-4 rounded-lg border border-[#198754]/30 bg-[#198754]/10 px-4 py-3 text-sm text-[#198754] font-medium">
              ✓ All required documents uploaded. EMC HR has been notified and will verify them. You will receive an email once verification is complete.
            </div>
          )}
        </div>

        {error && <div className="mb-4 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {docs.map((d) => {
            const pct = uploading[d.categoryId];
            const busy = pct !== undefined;
            const viewUrl = d.fileId ? `/api/v1/files/${d.fileId}/portal?token=${encodeURIComponent(token)}` : null;
            return (
              <div key={d.id} className="card p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold ink-body text-sm leading-snug">{d.category?.name}</h3>
                    {d.category?.isRequired ? <span className="text-[10px] uppercase font-bold text-[#F28C28] tracking-wider">Required</span> : <span className="text-[10px] uppercase font-bold ink-soft tracking-wider">Optional</span>}
                  </div>
                  <span className={`badge whitespace-nowrap ${STATUS_STYLE[d.status] || STATUS_STYLE.NOT_UPLOADED}`}>{STATUS_LABEL[d.status] || d.status}</span>
                </div>

                {d.remarks && <p className="text-[11px] text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1">HR note: {d.remarks}</p>}

                {d.file && (
                  <div className="flex items-center gap-2 text-xs ink-soft min-w-0">
                    <span className="truncate">{d.file.originalName}</span>
                    <span className="shrink-0">({(d.file.size / 1024).toFixed(0)} KB)</span>
                    {viewUrl && <a className="shrink-0 text-[#198754] font-semibold hover:underline" href={viewUrl} target="_blank" rel="noreferrer">View</a>}
                  </div>
                )}

                {busy ? (
                  <div>
                    <div className="flex justify-between text-[10px] font-semibold ink-soft mb-1"><span>Uploading…</span><span>{pct}%</span></div>
                    <div className="h-2 rounded-full bg-[#171717]/10 overflow-hidden"><div className="h-full bg-[#198754] transition-all" style={{ width: `${pct}%` }} /></div>
                  </div>
                ) : (
                  <label className="mt-auto flex items-center justify-center gap-2 rounded-lg border border-dashed border-[#198754]/50 px-3 py-2.5 text-xs font-semibold text-[#198754] cursor-pointer hover:bg-[#198754]/5 transition-colors">
                    {d.status === "NOT_UPLOADED" ? "+ Choose file to upload" : "↻ Upload a replacement"}
                    <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" onChange={(e) => upload(d.categoryId, e.target.files?.[0])} />
                  </label>
                )}
              </div>
            );
          })}
          {docs.length === 0 && <p className="ink-soft text-sm">No document requirements are configured yet. EMC HR will add them shortly.</p>}
        </div>
      </div>
    </div>
  );
}
