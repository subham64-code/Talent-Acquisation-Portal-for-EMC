import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, FileSearch, Mail, MessageSquarePlus, MoveRight, PauseCircle, Phone, PlayCircle, ShieldQuestion, XCircle } from "lucide-react";
import PageHeader from "../../components/ref/PageHeader";
import Button from "../../components/ref/Button";
import Modal from "../../components/ref/Modal";
import { Textarea } from "../../components/ref/Input";
import CandidateStatusBadge from "../../components/ref/CandidateStatusBadge";
import { hrApi } from "../../lib/api";
import { formatDate, formatDateTime } from "./databank/shared";
import { APPLICATION_STATUS_LABELS, APPLICATION_TRANSITIONS, canTransition } from "../../lib/applicationTransitions";

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
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await hrApi.application(String(id), { profile: 1 });
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

  const previewUrlRef = useRef<string | null>(null);
  useEffect(() => { previewUrlRef.current = previewUrl; }, [previewUrl]);
  useEffect(() => () => {
    const current = previewUrlRef.current;
    if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
  }, []);

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

  const runStatus = async (status: string, remarks?: string, actionKey = status) => {
    if (!app) return;
    setBusyAction(actionKey);
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
      setBusyAction(null);
    }
  };

  const addRemark = async () => {
    if (!app || !remark.trim()) return;
    setBusyAction("remark");
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
      setBusyAction(null);
    }
  };

  const timeline = Array.isArray(app?.statusHistory) ? [...app.statusHistory].reverse() : [];
  const nextStatuses = APPLICATION_TRANSITIONS[app?.status ?? ""] ?? [];
  const canGo = (to: string) => canTransition(app?.status, to);

  const runPanelStatus = (status: string) => {
    if (status === "REJECTED") return setRejectOpen(true);
    const label = APPLICATION_STATUS_LABELS[status] ?? status.replace(/_/g, " ").toLowerCase();
    if (["HIRED", "WITHDRAWN"].includes(status) && !window.confirm(`${label} this application? This cannot be undone.`)) return;
    return runStatus(status, `Moved to ${label} by HR`);
  };

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
            {canGo("UNDER_REVIEW") && <Button icon={MoveRight} onClick={() => void runStatus("UNDER_REVIEW", "Moved to CV screening by HR.", "screen")} loading={busyAction === "screen"} disabled={Boolean(busyAction)}>Move to Screening</Button>}
            {canGo("ON_HOLD") && <Button variant="outline" icon={PauseCircle} onClick={() => void runStatus("ON_HOLD", "Application placed on hold by HR", "hold")} loading={busyAction === "hold"} disabled={Boolean(busyAction)}>Put on Hold</Button>}
            {canGo("UNDER_REVIEW") && app.status === "ON_HOLD" && <Button variant="outline" icon={PlayCircle} onClick={() => void runStatus("UNDER_REVIEW", "Application resumed by HR", "resume")} loading={busyAction === "resume"} disabled={Boolean(busyAction)}>Resume</Button>}
            {canGo("REJECTED") && <Button variant="danger-ghost" icon={XCircle} onClick={() => setRejectOpen(true)}>Reject Application</Button>}
          </>
        )}
      />

      <div className="ta-profile-grid">
        <section className="card ta-profile-main">
          <div className="card__header"><div><div className="card__title">Personal information</div><div className="card__subtitle">Details submitted with the application</div></div><CandidateStatusBadge status={app.status} /></div>
          <div className="card__body"><div className="detail-grid detail-grid--3">
            <div className="detail-item"><div className="detail-item__label">Candidate ID</div><div className="detail-item__value">{candidate.candidateCode || "—"}</div></div>
            <div className="detail-item"><div className="detail-item__label">Application ID</div><div className="detail-item__value">{app.applicationCode}</div></div>
            <div className="detail-item"><div className="detail-item__label"><Mail size={12} aria-hidden="true" /> Email</div><div className="detail-item__value">{candidate.email}</div></div>
            <div className="detail-item"><div className="detail-item__label"><Phone size={12} aria-hidden="true" /> Phone</div><div className="detail-item__value">{candidate.mobile || candidate.phone || "—"}</div></div>
          </div></div>
        </section>

        <section className="card"><div className="card__header"><div><div className="card__title">Job application</div><div className="card__subtitle">Position the candidate applied for</div></div></div><div className="card__body"><div className="detail-grid"><div className="detail-item"><div className="detail-item__label">Position</div><div className="detail-item__value">{job?.title || "—"}</div></div><div className="detail-item"><div className="detail-item__label">Department</div><div className="detail-item__value">{job?.department?.name || "—"}</div></div><div className="detail-item"><div className="detail-item__label">Applied on</div><div className="detail-item__value">{formatDate(app.appliedAt)}</div></div><div className="detail-item"><div className="detail-item__label">Source</div><div className="detail-item__value">{app.source || "Career Portal"}</div></div><div className="detail-item"><div className="detail-item__label">Required experience</div><div className="detail-item__value">{job?.minExperience ?? 0} yrs</div></div><div className="detail-item"><div className="detail-item__label">Required qualification</div><div className="detail-item__value">{job?.requiredQualification || "—"}</div></div></div><div className="detail-item" style={{ marginTop: "0.75rem" }}><div className="detail-item__label">Latest HR remark</div><div className="detail-item__value">{app.hrRemarks || "No remarks recorded yet."}</div></div><div className="detail-item" style={{ marginTop: "0.75rem" }}><div className="detail-item__label">Documents available</div><div className="detail-item__value">{app.resumeFileId ? "CV received" : "No CV has been received yet"}</div></div></div></section>
      </div>

      <section className="card">
        <div className="card__header">
          <div>
            <div className="card__title">Application actions</div>
            <div className="card__subtitle">Move this application to the next recruitment stage</div>
          </div>
          <CandidateStatusBadge status={app.status} />
        </div>
        <div className="card__body">
          {!["REJECTED", "SELECTED"].includes(app.status) && (
            <Button variant="outline" icon={MessageSquarePlus} onClick={() => setRemarkOpen(true)}>Add Remark</Button>
          )}
          {nextStatuses.length === 0 ? (
            <p className="detail-item__value detail-item__value--muted">No further transitions are available from {app.status.replace(/_/g, " ").toLowerCase()}.</p>
          ) : (
            <div className="ta-chip-list">
              {nextStatuses.map((status) => (
                <Button
                  key={status}
                  variant={status === "REJECTED" ? "danger-ghost" : status === "WITHDRAWN" ? "ghost" : "outline"}
                  icon={status === "SHORTLISTED" ? MoveRight : undefined}
                  onClick={() => runPanelStatus(status)}
                  disabled={Boolean(busyAction)}
                  loading={busyAction === status}
                >
                  {APPLICATION_STATUS_LABELS[status] ?? status.replace(/_/g, " ")}
                </Button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="card"><div className="card__header"><div><div className="card__title">Technical skills</div><div className="card__subtitle">Skills listed by the candidate</div></div></div><div className="card__body">{candidate.skills?.length ? <div className="ta-chip-list">{candidate.skills.map((record: any) => <span className="ta-chip" key={record.id || record.skill?.name}>{record.skill?.name || String(record)}</span>)}</div> : <p className="detail-item__value detail-item__value--muted">No skills were provided.</p>}</div></section>

      <section className="card"><div className="card__header"><div><div className="card__title">Recruitment timeline</div><div className="card__subtitle">Every recorded transition of this application</div></div></div><div className="card__body">{timeline.length === 0 ? <p className="detail-item__value detail-item__value--muted">No timeline entries recorded yet.</p> : <ol className="ta-timeline">{timeline.map((entry: any, index: number) => <li className="ta-timeline__item" key={`${entry.id}-${index}`}><span className="ta-timeline__dot" aria-hidden="true" /><div className="ta-timeline__body"><div className="ta-timeline__event">{entry.toStatus}{entry.fromStatus && <span className="ta-timeline__transition">{' '}{entry.fromStatus.replace(/_/g, " ")} → {entry.toStatus.replace(/_/g, " ")}</span>}</div><div className="ta-timeline__meta">{formatDateTime(entry.createdAt)}{entry.changedBy?.email ? ` · ${entry.changedBy.email}` : ""}</div>{entry.remarks && <div className="ta-timeline__note">{entry.remarks}</div>}</div></li>)}</ol>}</div></section>

      <Modal
        open={remarkOpen}
        onClose={() => setRemarkOpen(false)}
        title="Add HR remark"
        size="sm"
        footer={<><Button variant="outline" onClick={() => setRemarkOpen(false)} disabled={Boolean(busyAction)}>Cancel</Button><Button icon={MessageSquarePlus} onClick={() => void addRemark()} disabled={!remark.trim() || Boolean(busyAction)} loading={busyAction === "remark"}>Save remark</Button></>}
      >
        <Textarea value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="Remark shared with the recruitment team…" rows={4} />
      </Modal>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject application"
        size="sm"
        footer={<><Button variant="outline" onClick={() => setRejectOpen(false)} disabled={Boolean(busyAction)}>Keep application</Button><Button variant="danger" icon={XCircle} onClick={() => void runStatus("REJECTED", rejectionReason.trim() || "Rejected by HR", "reject")} loading={busyAction === "reject"} disabled={Boolean(busyAction)}>Reject application</Button></>}
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
