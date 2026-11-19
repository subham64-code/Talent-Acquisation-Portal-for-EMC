import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Briefcase, Download, FileSearch, GraduationCap, Mail, MapPin, MessageSquarePlus, MoveRight, PauseCircle, Phone, PlayCircle, ShieldQuestion, XCircle } from "lucide-react";
import PageHeader from "../../components/ref/PageHeader";
import Button from "../../components/ref/Button";
import Modal from "../../components/ref/Modal";
import Badge from "../../components/ref/Badge";
import { Textarea } from "../../components/ref/Input";
import CandidateStatusBadge from "../../components/ref/CandidateStatusBadge";
import CandidateAdditionalInfo from "../../components/ref/CandidateAdditionalInfo";
import { hrApi } from "../../lib/api";
import { initials, formatDate, formatDateTime } from "./databank/shared";

export default function CandidateProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [remarkOpen, setRemarkOpen] = useState(false);
  const [remark, setRemark] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await hrApi.application(String(id));
      setApplication(r?.data?.item ?? r?.data ?? null);
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not load the candidate profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [id]);

  const app = application;
  const candidate = app?.candidate;
  const job = app?.jobOpening;
  const canTransition = (to: string) => {
    const allowed: Record<string, string[]> = {
      APPLIED: ["UNDER_REVIEW", "AI_RECOMMENDED", "SHORTLISTED", "REJECTED", "ON_HOLD"],
      UNDER_REVIEW: ["AI_RECOMMENDED", "SHORTLISTED", "REJECTED", "ON_HOLD"],
      AI_RECOMMENDED: ["UNDER_REVIEW", "SHORTLISTED", "REJECTED", "ON_HOLD"],
      SHORTLISTED: ["INTERVIEW_SCHEDULED", "SELECTED", "REJECTED", "ON_HOLD"],
      INTERVIEW_SCHEDULED: ["INTERVIEW_COMPLETED", "SHORTLISTED", "REJECTED", "ON_HOLD"],
      INTERVIEW_COMPLETED: ["SELECTED", "REJECTED", "ON_HOLD"],
      ON_HOLD: ["UNDER_REVIEW", "SHORTLISTED", "REJECTED"],
      SELECTED: ["REJECTED", "ON_HOLD"],
    };
    return allowed[app?.status]?.includes(to) ?? false;
  };

  const docs = [
    app?.resumeFile ? { id: app.resumeFile.id, category: { name: "Resume", isRequired: true }, status: "ACCEPTED" } : null,
    ...(app?.documents ?? []),
  ].filter(Boolean) as any[];

  const openFile = async (fileId?: string) => {
    if (!fileId) return;
    setPreviewing(true);
    setError("");
    try {
      const r = await hrApi.fileAccessToken(fileId);
      const token = r?.data?.token;
      if (token) {
        const blobRes = await hrApi.file(fileId, token);
        if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blobRes.data as Blob));
      } else if (r?.data?.url) {
        setPreviewUrl(r.data.url);
      }
    } catch {
      setError("Could not open the file.");
    } finally {
      setPreviewing(false);
    }
  };

  const runStatus = async (status: string, remarks?: string) => {
    if (!app) return;
    setBusy(true);
    setError("");
    try {
      await hrApi.applicationStatus(app.id, { status, remarks });
      setNotice(`Application marked as ${status.replace(/_/g, " ").toLowerCase()}.`);
      setRejectOpen(false);
      setRemarkOpen(false);
      setRejectionReason("");
      setRemark("");
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not change the application status.");
    } finally {
      setBusy(false);
    }
  };

  const addRemark = async () => {
    if (!app || !remark.trim()) return;
    setBusy(true);
    setError("");
    try {
      await hrApi.applicationRemarks(app.id, { body: remark.trim() });
      setNotice("HR remark recorded.");
      setRemarkOpen(false);
      setRemark("");
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not record the remark.");
    } finally {
      setBusy(false);
    }
  };

  const timeline = Array.isArray(app?.statusHistory) ? [...app.statusHistory].reverse() : [];

  if (loading && !app) {
    return <div className="loading-block"><div className="spinner" /> Loading candidate profile…</div>;
  }

  if (!app || !candidate) {
    return (
      <div className="page">
        <PageHeader eyebrow="Ecometrix · Talent Acquisition" title="Candidate not found" subtitle="The application reference could not be resolved in the recruitment records." />
        <div className="card"><div className="empty-state"><span className="empty-state__icon"><ShieldQuestion size={24} aria-hidden="true" /></span><p className="empty-state__title">Unknown application</p><p className="empty-state__text">The application <strong>{id}</strong> is not part of the Talent Acquisition records.</p><div className="empty-state__action"><Link className="btn btn--primary" to="/hr/submissions">Back to applications</Link></div></div></div>
      </div>
    );
  }

  return (
    <div className="page">
      <Link className="back-link" to="/hr/submissions"><ArrowLeft size={16} aria-hidden="true" /> Back to Candidate Applications</Link>

      {notice && <div className="notice notice--success" role="status"><div className="notice__body">{notice}</div></div>}
      {error && <div className="notice notice--error" role="alert"><div className="notice__body">{error}</div></div>}

      <PageHeader
        eyebrow={<><Link to="/hr/submissions">Candidate Applications</Link></>}
        title={candidate.fullName}
        subtitle={`${job?.title || "Position"} · application ${app.applicationCode}`}
        actions={(
          <>
            <Button variant="outline" icon={ArrowLeft} onClick={() => navigate("/hr/submissions")}>Back</Button>
            <Button variant="outline" icon={FileSearch} onClick={() => void openFile(app.resumeFileId ?? undefined)} disabled={!app.resumeFileId || previewing}>Preview CV</Button>
            <Button variant="outline" icon={Download} onClick={() => { if (previewUrl) window.open(previewUrl, "_blank", "noreferrer"); }} disabled={!previewUrl}>Download CV</Button>
            {!["REJECTED", "SELECTED"].includes(app.status) && <Button variant="ghost" icon={MessageSquarePlus} onClick={() => setRemarkOpen(true)}>Add Remark</Button>}
            {canTransition("UNDER_REVIEW") && <Button icon={MoveRight} onClick={() => runStatus("UNDER_REVIEW", "Moved to CV screening by HR.")} loading={busy}>Move to Screening</Button>}
            {canTransition("ON_HOLD") && <Button variant="outline" icon={PauseCircle} onClick={() => runStatus("ON_HOLD", "Application placed on hold by HR")} loading={busy}>Put on Hold</Button>}
            {canTransition("UNDER_REVIEW") && app.status === "ON_HOLD" && <Button variant="outline" icon={PlayCircle} onClick={() => runStatus("UNDER_REVIEW", "Application resumed by HR")} loading={busy}>Resume</Button>}
            {canTransition("REJECTED") && <Button variant="danger-ghost" icon={XCircle} onClick={() => setRejectOpen(true)}>Reject Application</Button>}
          </>
        )}
      />

      <div className="ta-profile-grid">
        <section className="card ta-profile-main">
          <div className="card__header"><div><div className="card__title">Personal information</div><div className="card__subtitle">Details submitted with the application</div></div><CandidateStatusBadge status={app.status} /></div>
          <div className="card__body"><div className="detail-grid detail-grid--3">
            <div className="detail-item"><div className="detail-item__label">Candidate ID</div><div className="detail-item__value">{candidate.candidateCode || "—"}</div></div>
            <div className="detail-item"><div className="detail-item__label">Application ID</div><div className="detail-item__value">{app.applicationCode}</div></div>
            <div className="detail-item"><div className="detail-item__label">Current title</div><div className="detail-item__value">{candidate.currentDesignation || "Not provided"}</div></div>
            <div className="detail-item"><div className="detail-item__label"><Mail size={12} aria-hidden="true" /> Email</div><div className="detail-item__value">{candidate.email}</div></div>
            <div className="detail-item"><div className="detail-item__label"><Phone size={12} aria-hidden="true" /> Phone</div><div className="detail-item__value">{candidate.mobile || candidate.phone || "—"}</div></div>
            <div className="detail-item"><div className="detail-item__label"><MapPin size={12} aria-hidden="true" /> Location</div><div className="detail-item__value">{candidate.currentLocation || "—"}</div></div>
          </div></div>
        </section>

        <section className="card"><div className="card__header"><div><div className="card__title">Job application</div><div className="card__subtitle">Position the candidate applied for</div></div></div><div className="card__body"><div className="detail-grid"><div className="detail-item"><div className="detail-item__label">Position</div><div className="detail-item__value">{job?.title || "—"}</div></div><div className="detail-item"><div className="detail-item__label">Department</div><div className="detail-item__value">{job?.department?.name || "—"}</div></div><div className="detail-item"><div className="detail-item__label">Applied on</div><div className="detail-item__value">{formatDate(app.appliedAt)}</div></div><div className="detail-item"><div className="detail-item__label">Source</div><div className="detail-item__value">{app.source || "Career Portal"}</div></div><div className="detail-item"><div className="detail-item__label">Required experience</div><div className="detail-item__value">{job?.minExperience ?? 0} yrs</div></div><div className="detail-item"><div className="detail-item__label">Required qualification</div><div className="detail-item__value">{job?.requiredQualification || "—"}</div></div></div><div className="detail-item" style={{ marginTop: "0.75rem" }}><div className="detail-item__label">Latest HR remark</div><div className="detail-item__value">{app.hrRemarks || "No remarks recorded yet."}</div></div><div className="detail-item" style={{ marginTop: "0.75rem" }}><div className="detail-item__label">Documents available</div><div className="detail-item__value">{app.resumeFileId ? "CV received" : "No CV has been received yet"}</div></div></div></section>
      </div>

      <CandidateAdditionalInfo value={candidate.additionalInfo} />

      <section className="card"><div className="card__header"><div><div className="card__title">Technical skills</div><div className="card__subtitle">Skills listed by the candidate</div></div></div><div className="card__body">{candidate.skills?.length ? <div className="ta-chip-list">{candidate.skills.map((record: any) => <span className="ta-chip" key={record.id || record.skill?.name}>{record.skill?.name || String(record)}</span>)}</div> : <p className="detail-item__value detail-item__value--muted">No skills were provided.</p>}</div></section>

      <div className="ta-profile-grid">
        <section className="card"><div className="card__header"><div><div className="card__title">Education details</div><div className="card__subtitle">Qualifications submitted with the application</div></div><GraduationCap size={18} aria-hidden="true" /></div><div className="card__body">{candidate.education?.length ? <ul className="ta-detail-list">{candidate.education.map((item: any) => <li className="ta-detail-list__item" key={item.id}><div className="ta-detail-list__title">{item.degree}</div><div className="ta-detail-list__meta">{item.institution}{item.field ? ` · ${item.field}` : ""}{item.endYear ? ` · ${item.endYear}` : ""}</div></li>)}</ul> : <p className="detail-item__value detail-item__value--muted">No education details were provided.</p>}</div></section>
        <section className="card"><div className="card__header"><div><div className="card__title">Professional experience</div><div className="card__subtitle">Previous roles</div></div><Briefcase size={18} aria-hidden="true" /></div><div className="card__body">{candidate.employmentHistory?.length ? <ul className="ta-detail-list">{candidate.employmentHistory.map((item: any) => <li className="ta-detail-list__item" key={item.id}><div className="ta-detail-list__title">{item.title || "Role"} · {item.organization}</div><div className="ta-detail-list__meta">{item.startDate ? new Date(item.startDate).getFullYear() : ""}{item.endDate ? ` → ${new Date(item.endDate).getFullYear()}` : " → Present"}{item.description ? ` · ${item.description}` : ""}</div></li>)}</ul> : <p className="detail-item__value detail-item__value--muted">No professional experience was provided.</p>}</div></section>
      </div>

      <div className="ta-profile-grid">
        <section className="card"><div className="card__header"><div><div className="card__title">Certifications</div><div className="card__subtitle">Certificates claimed by the candidate</div></div><BadgeCheck size={18} aria-hidden="true" /></div><div className="card__body">{candidate.certifications?.length ? <ul className="ta-detail-list">{candidate.certifications.map((item: any) => <li className="ta-detail-list__item" key={item.id}><div className="ta-detail-list__title">{item.name}</div><div className="ta-detail-list__meta">{item.issuer}{item.issuedAt ? ` · ${new Date(item.issuedAt).getFullYear()}` : ""}</div></li>)}</ul> : <p className="detail-item__value detail-item__value--muted">No certifications were provided.</p>}</div></section>
        <section className="card"><div className="card__header"><div><div className="card__title">Uploaded documents</div><div className="card__subtitle">Files submitted through the Career Portal</div></div></div><div className="card__body">{docs.length === 0 ? <p className="detail-item__value detail-item__value--muted">No documents received yet.</p> : <ul className="ta-detail-list">{docs.map((doc: any) => <li className="ta-detail-list__item" key={doc.id}><div className="ta-detail-list__title">{doc.category?.name || "Document"}</div><div className="ta-detail-list__meta">{doc.status || "Received"}{doc.fileId && <button type="button" className="ta-link" onClick={() => void openFile(doc.fileId)}>Preview</button>}</div></li>)}</ul>}</div></section>
      </div>

      <section className="card"><div className="card__header"><div><div className="card__title">Recruitment timeline</div><div className="card__subtitle">Every recorded transition of this application</div></div></div><div className="card__body">{timeline.length === 0 ? <p className="detail-item__value detail-item__value--muted">No timeline entries recorded yet.</p> : <ol className="ta-timeline">{timeline.map((entry: any, index: number) => <li className="ta-timeline__item" key={`${entry.id}-${index}`}><span className="ta-timeline__dot" aria-hidden="true" /><div className="ta-timeline__body"><div className="ta-timeline__event">{entry.toStatus}{entry.fromStatus && <span className="ta-timeline__transition">{' '}{entry.fromStatus.replace(/_/g, " ")} → {entry.toStatus.replace(/_/g, " ")}</span>}</div><div className="ta-timeline__meta">{formatDateTime(entry.createdAt)}{entry.changedBy?.email ? ` · ${entry.changedBy.email}` : ""}</div>{entry.remarks && <div className="ta-timeline__note">{entry.remarks}</div>}</div></li>)}</ol>}</div></section>

      <Modal
        open={remarkOpen}
        onClose={() => setRemarkOpen(false)}
        title="Add HR remark"
        size="sm"
        footer={<><Button variant="outline" onClick={() => setRemarkOpen(false)} disabled={busy}>Cancel</Button><Button icon={MessageSquarePlus} onClick={addRemark} disabled={!remark.trim() || busy} loading={busy}>Save remark</Button></>}
      >
        <Textarea value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="Remark shared with the recruitment team…" rows={4} />
      </Modal>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject application"
        size="sm"
        footer={<><Button variant="outline" onClick={() => setRejectOpen(false)} disabled={busy}>Keep application</Button><Button variant="danger" icon={XCircle} onClick={() => runStatus("REJECTED", rejectionReason.trim() || "Rejected by HR")} loading={busy}>Reject application</Button></>}
      >
        <Textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Describe why the candidate is not progressing (optional)" rows={4} />
      </Modal>

      <Modal
        open={Boolean(previewUrl)}
        onClose={() => { if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }}
        title="Candidate CV"
        size="lg"
        footer={<Button icon={Download} onClick={() => previewUrl && window.open(previewUrl, "_blank", "noreferrer")} loading={previewing}>Open</Button>}
      >
        {previewUrl && <iframe title="Candidate CV" src={previewUrl} style={{ width: "100%", height: 520, border: 0 }} />}
      </Modal>
    </div>
  );
}
