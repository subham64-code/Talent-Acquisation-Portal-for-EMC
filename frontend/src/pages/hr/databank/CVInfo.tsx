import { useEffect, useState } from "react";
import { Download, Eye, FileText, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { hrApi } from "../../../lib/api";
import { useApiQuery, useInvalidate } from "../../../hooks/useApiQuery";
import { fileSize } from "./shared";

export default function CVInfo({ employeeId, allowReplace = false, allowRemove = false, frameId }: {
  employeeId: string;
  allowReplace?: boolean;
  allowRemove?: boolean;
  frameId?: string;
}) {
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const { data: employee, isLoading } = useApiQuery<any>(
    ["employee", employeeId],
    () => hrApi.employee(employeeId).then((r: any) => r?.data?.item),
  );

  const current = (employee?.cvVersions ?? []).find((version: any) => version.isCurrent) || (employee?.cvVersions ?? [])[0];
  const file = current?.file ?? null;

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const openFile = async (download: boolean) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const tokenRes = await hrApi.fileAccessToken(file.id);
      const token = tokenRes?.data?.token;
      const blobRes = await hrApi.file(file.id, token);
      const url = URL.createObjectURL(blobRes.data as Blob);
      if (download) {
        const link = document.createElement("a");
        link.href = url;
        link.download = file.originalName || "employee-cv";
        link.click();
        URL.revokeObjectURL(url);
      } else {
        setPreviewUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return url;
        });
        setPreviewing(true);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "The CV could not be opened.");
    } finally {
      setBusy(false);
    }
  };

  const replace = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected || !employeeId) return;
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("cv", selected);
      await hrApi.uploadEmployeeCv(employeeId, fd);
      invalidate(["employees", "employee"]);
      setMessage("The employee CV was replaced.");
    } catch (err: any) {
      setMessage("");
      setError(err?.response?.data?.error?.message || "The CV could not be replaced.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Remove the current CV from this employee record?")) return;
    setBusy(true);
    setError("");
    try {
      await hrApi.removeEmployeeCv(employeeId);
      invalidate(["employees", "employee"]);
      setMessage("The employee CV was removed.");
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "The CV could not be removed.");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <div className="loading-block"><div className="spinner" /> Loading CV…</div>;

  if (!file) {
    return (
      <div className="cv-missing">
        <div className="empty-state__icon"><FileText size={22} aria-hidden="true" /></div>
        <p className="empty-state__title">No CV on file</p>
        <p className="empty-state__text">Upload a PDF or Word document to complete this employee record.</p>
        {allowReplace && (
          <label className="btn btn--primary btn--sm" style={{ marginTop: "0.75rem" }}>
            <Upload size={15} aria-hidden="true" /> Upload CV
            <input className="visually-hidden" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={replace} />
          </label>
        )}
        {message && <p className="notice notice--success" role="status"><span className="notice__body">{message}</span></p>}
        {error && <div className="notice notice--error" role="alert"><span className="notice__body">{error}</span></div>}
      </div>
    );
  }

  return (
    <div>
      <div className="cv-file">
        <span className="cv-file__icon"><FileText size={22} aria-hidden="true" /></span>
        <div className="cv-file__info">
          <div className="cv-file__name">{file.originalName || "Employee CV"}</div>
          <div className="cv-file__meta">{file.mimeType || "document"} · {fileSize(file.size)} · current version</div>
        </div>
        <div className="cv-file__actions">
          <button type="button" className="btn btn--ghost btn--icon" onClick={() => void openFile(false)} disabled={busy} title="Preview CV" aria-label="Preview CV"><Eye size={16} /></button>
          <button type="button" className="btn btn--ghost btn--icon" onClick={() => void openFile(true)} disabled={busy} title="Download CV" aria-label="Download CV"><Download size={16} /></button>
          {allowReplace && (
            <label className="btn btn--ghost btn--icon" title="Replace CV" aria-label="Replace CV">
              <Upload size={16} />
              <input className="visually-hidden" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={replace} disabled={busy} />
            </label>
          )}
          {allowRemove && <button type="button" className="btn btn--danger-ghost btn--icon" onClick={remove} disabled={busy} title="Remove CV" aria-label="Remove CV"><Trash2 size={16} /></button>}
        </div>
      </div>
      {message && <p className="notice notice--success" role="status" style={{ marginTop: "0.75rem" }}><span className="notice__body">{message}</span></p>}
      {error && <div className="notice notice--error" role="alert" style={{ marginTop: "0.75rem" }}><span className="notice__body">{error}</span></div>}
      {previewing && (
        <div className="cv-preview__frame" style={{ position: "relative", height: 420, marginTop: "0.75rem" }}>
          <button type="button" className="btn btn--ghost btn--icon" style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }} onClick={() => setPreviewing(false)} aria-label="Close preview"><X size={16} /></button>
          {previewUrl && <iframe title={frameId ?? "CV preview"} src={previewUrl} style={{ width: "100%", height: "100%", border: 0 }} />}
        </div>
      )}
    </div>
  );
}
