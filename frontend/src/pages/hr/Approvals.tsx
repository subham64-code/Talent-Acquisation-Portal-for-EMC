import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  Download,
  Eye,
  FileSearch,
  GraduationCap,
  Mail,
  MapPin,
  MoveRight,
  PauseCircle,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UsersRound,
  XCircle,
} from "lucide-react";
import { hrApi } from "../../lib/api";
import PageHeader from "../../components/ref/PageHeader";
import Button from "../../components/ref/Button";
import Badge from "../../components/ref/Badge";
import Modal from "../../components/ref/Modal";
import CandidateStatusBadge from "../../components/ref/CandidateStatusBadge";
import EmptyState from "../../components/ref/EmptyState";
import DataTable, { type Column } from "../../components/DataTable";
import { initials, formatDate, formatDateTime } from "./databank/shared";
import { Input, Textarea } from "../../components/ref/Input";

type Filter = "pending" | "approved" | "all";

export default function Approvals() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Filter>("pending");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [review, setReview] = useState<any>(null);
  const [reviewDetail, setReviewDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [approvalOffered, setApprovalOffered] = useState("");
  const [approvalExpected, setApprovalExpected] = useState("");
  const [approvalAiScore, setApprovalAiScore] = useState("");
  const [approvalFeedback, setApprovalFeedback] = useState("");
  const [savingApproval, setSavingApproval] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [selected, offerRows] = await Promise.all([
        hrApi.applications({ page: 1, pageSize: 100, status: "SELECTED" }).then((r: any) => r?.data?.items ?? []).catch(() => []),
        hrApi.offers({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? r?.data ?? []).catch(() => []),
      ]);
      setApplications(selected);
      setOffers(offerRows);
      setError("");
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Could not load approval queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    const app = reviewDetail ?? review;
    if (!app) return;
    setApprovalOffered(app.finalSelectionSalary != null ? String(app.finalSelectionSalary) : app.offer?.ctc != null ? String(app.offer.ctc) : "");
    setApprovalExpected(app.finalSelectionExpectedSalary != null ? String(app.finalSelectionExpectedSalary) : app.expectedSalary != null ? String(app.expectedSalary) : "");
    setApprovalAiScore(app.aiMatchScore != null ? String(Math.round(Number(app.aiMatchScore))) : "");
    setApprovalFeedback(app.finalSelectionNote ?? app.hrRemarks ?? app.offer?.responseRemarks ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewDetail, review]);

  const openReview = async (application: any) => {
    setReview(application);
    setReviewDetail(null);
    setDetailLoading(true);
    setRejecting(false);
    setRejectionReason("");
    try {
      const res = await hrApi.application(application.id);
      setReviewDetail(res?.data?.item ?? res?.data ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Could not load the full candidate record.");
    } finally {
      setDetailLoading(false);
    }
  };

  const saveApprovalRecommendation = async () => {
    if (!review) throw new Error("No application selected.");
    const trimmedOffer = approvalOffered.trim();
    const trimmedExpected = approvalExpected.trim();
    const trimmedScore = approvalAiScore.trim();
    const nextOffered = trimmedOffer === "" ? null : Number(trimmedOffer.replace(/[₹,\s]/g, "").replace(/^(?:rs|inr)\.?/i, ""));
    const nextExpected = trimmedExpected === "" ? null : Number(trimmedExpected.replace(/[₹,\s]/g, "").replace(/^(?:rs|inr)\.?/i, ""));
    const nextScore = trimmedScore === "" ? null : Number(trimmedScore);
    if (nextOffered !== null && (!Number.isFinite(nextOffered) || nextOffered < 0)) throw new Error("Enter a valid offered salary.");
    if (nextExpected !== null && (!Number.isFinite(nextExpected) || nextExpected < 0)) throw new Error("Enter a valid expected salary.");
    if (nextScore !== null && (!Number.isFinite(nextScore) || nextScore < 0)) throw new Error("Enter a valid AI score.");
    setSavingApproval(true);
    try {
      const response = await hrApi.saveApplicationApproval(review.id, { finalSelectionSalary: nextOffered, finalSelectionExpectedSalary: nextExpected, aiMatchScore: nextScore, finalSelectionNote: approvalFeedback.trim() || null });
      const updated = response?.data?.item ?? response?.data?.data?.item ?? null;
      if (updated) {
        setApplications((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
        setReviewDetail((current: any) => current ? { ...current, ...updated } : current);
      }
      setNotice("Approval details saved.");
      return updated;
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || err?.message || "Could not save approval details.";
      setError(message);
      throw new Error(message);
    } finally {
      setSavingApproval(false);
    }
  };

  const closeReview = () => {
    if (busy) return;
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setReview(null);
    setReviewDetail(null);
  };

  const offeredApplicationIds = useMemo(() => new Set(offers.map((offer: any) => offer.applicationId).filter(Boolean)), [offers]);
  const pending = useMemo(() => applications.filter((app) => !offeredApplicationIds.has(app.id)), [applications, offeredApplicationIds]);
  const approved = useMemo(() => applications.filter((app) => offeredApplicationIds.has(app.id)), [applications, offeredApplicationIds]);

  const counts = { pending: pending.length, approved: approved.length, all: applications.length };

  const filtered = useMemo(() => {
    const source = statusFilter === "pending" ? pending : statusFilter === "approved" ? approved : applications;
    const term = search.trim().toLowerCase();
    if (!term) return source;
    return source.filter((app) => `${app.candidate?.fullName ?? ""} ${app.candidate?.email ?? ""} ${app.jobOpening?.title ?? ""} ${app.applicationCode ?? ""}`.toLowerCase().includes(term));
  }, [applications, pending, approved, search, statusFilter]);

  const changeStatus = async (id: string, status: string, remarks?: string) => {
    setBusy(true);
    setError("");
    try {
      await hrApi.applicationStatus(id, { status, remarks });
      setNotice(`Application marked as ${status.replace(/_/g, " ").toLowerCase()}.`);
      setReview(null);
      setReviewDetail(null);
      setRejecting(false);
      if (["REJECTED", "ON_HOLD"].includes(status)) setSelectedIds((current) => { const next = new Set(current); next.delete(id); return next; });
      await load(true);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Status change failed.");
    } finally {
      setBusy(false);
    }
  };

  const selectCandidate = async (application: any) => {
    try {
      const updated = await saveApprovalRecommendation();
      const currentValue = updated?.finalSelectionSalary ?? application.finalSelectionSalary ?? approvalOffered;
      setSelectedIds((current) => new Set([...current, application.id]));
      navigate(`/hr/offers?applicationId=${application.id}&ctc=${currentValue ?? ""}`);
    } catch {
      // Preserve admin context when validation or saving fails.
    }
  };

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
      setError("Could not open the CV.");
    } finally {
      setPreviewing(false);
    }
  };

  const app = reviewDetail ?? review;
  const candidate = app?.candidate;
  const job = app?.jobOpening;
  const offerExistsForReview = app ? offeredApplicationIds.has(app.id) : false;
  const isApproved = app ? selectedIds.has(app.id) || offerExistsForReview : false;
  const interviewerNames = (interview: any) => {
    const metadata = interview?.interviewerMetadata;
    const list = Array.isArray(metadata?.interviewers) ? metadata.interviewers : null;
    const names = list?.map((entry: any) => entry.name).filter(Boolean).join(", ") || interview?.interviewerName || "";
    return names || "Interviewer";
  };
  const interviewFeedbackLogs = (app?.interviews ?? []).map((interview: any) => {
    const feedbackList = Array.isArray(interview?.feedback) ? interview.feedback : interview?.feedback ? [interview.feedback] : [];
    const latest = feedbackList[feedbackList.length - 1] ?? null;
    const rawScore = Number(latest?.score ?? latest?.rating ?? 0);
    return {
      id: interview.id,
      round: interview.round,
      interviewer: interviewerNames(interview),
      scheduledAt: interview.scheduledAt,
      score: Number.isFinite(rawScore) && rawScore ? (rawScore > 5 ? rawScore / 20 : rawScore).toFixed(1) : null,
      feedback: latest?.feedback ?? latest?.remarks ?? "",
      recommendation: latest?.recommendation ?? latest?.outcome ?? "",
    };
  });
  const screeningMatch = (app?.matches && Array.isArray(app.matches) && app.matches[0]) || null;
  const skillScore = Number(screeningMatch?.skillScore ?? screeningMatch?.skill_score);
  const experienceScore = Number(screeningMatch?.experienceScore ?? screeningMatch?.experience_score);
  const interviewMatches = screeningMatch?.matchedSkills ?? screeningMatch?.matched_skills ?? [];
  const hrScreeningFeedback = app?.hrRemarks ?? app?.finalSelectionNote ?? "";
  const screeningSkillList = Array.isArray(interviewMatches) ? interviewMatches.map((item: any) => item?.name ?? String(item)).filter(Boolean) : String(interviewMatches).split(",").map((item) => item.trim()).filter(Boolean);
  const offeredSalary = reviewDetail?.finalSelectionSalary ?? review?.finalSelectionSalary ?? null;
  const expectedSalary = reviewDetail?.finalSelectionExpectedSalary ?? review?.finalSelectionExpectedSalary ?? null;
  const finalSelectionNote = reviewDetail?.finalSelectionNote ?? review?.finalSelectionNote ?? null;
  const skills = (candidate?.skills ?? []).map((record: any) => record.skill?.name || String(record)).filter(Boolean);
  const edu = candidate?.education ?? [];
  const history = candidate?.employmentHistory ?? [];
  const certs = candidate?.certifications ?? [];
  const documents = [
    app?.resumeFile ? { id: app.resumeFile.id, category: { name: "Resume", isRequired: true }, status: "ACCEPTED" } : null,
    ...(app?.documents ?? []),
  ].filter(Boolean) as any[];
  const timeline = Array.isArray(app?.statusHistory) ? [...app.statusHistory].reverse() : [];

  const columns: Column<any>[] = [
    {
      key: "candidate",
      header: "Candidate",
      render: (row) => (
        <div className="cell-user">
          <div className="avatar">{initials(row.candidate?.fullName || "")}</div>
          <div className="cell-user__text">
            <button type="button" className="ta-link cell-user__name" onClick={() => openReview(row)}>{row.candidate?.fullName}</button>
            <div className="cell-user__sub">{row.applicationCode}</div>
          </div>
        </div>
      ),
    },
    { key: "position", header: "Position", render: (row) => <div><div>{row.jobOpening?.title || "—"}</div><div className="cell-muted">{row.jobOpening?.department?.name || "—"}</div></div> },
    { key: "salary", header: "Salary", render: (row) => <span className="cell-muted">{row.finalSelectionSalary != null ? `₹ ${Number(row.finalSelectionSalary).toLocaleString()}` : "—"}</span> },
    { key: "score", header: "AI Score", render: (row) => row.aiMatchScore != null ? <span className="cell-strong">{Math.round(row.aiMatchScore)}</span> : <span className="cell-muted">—</span> },
    { key: "status", header: "Status", render: (row) => <CandidateStatusBadge status={row.status} /> },
    { key: "offer", header: "Offer", render: (row) => offeredApplicationIds.has(row.id) ? <Badge variant="blue">Prepared</Badge> : <Badge variant="orange">Not prepared</Badge> },
    { key: "actions", header: "Actions", className: "text-right", render: (row) => <div className="cell-actions"><button type="button" className="btn btn--ghost btn--icon" title="Open candidate" aria-label="Open candidate" onClick={() => openReview(row)}><Eye size={16} /></button>{row.resumeFileId && <button type="button" className="btn btn--ghost btn--icon" title="Preview CV" aria-label="Preview CV" onClick={() => void openFile(row.resumeFileId)}><FileSearch size={16} /></button>}{!offeredApplicationIds.has(row.id) && <button type="button" className="btn btn--outline btn--icon" title="Create offer" aria-label="Create offer" onClick={() => navigate(`/hr/offers?applicationId=${row.id}&ctc=${row.finalSelectionSalary ?? ""}`)}><CheckCircle2 size={16} /></button>}</div> },
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Ecometrix · Talent Acquisition"
        title="Admin Approval"
        subtitle="Hiring recommendations submitted by HR. Approve, reject or hold every recommendation and keep the approval trail for audit."
        actions={<Button variant="outline" icon={RefreshCw} onClick={() => void load(true)}>Refresh data</Button>}
      />

      {notice && <div className="notice notice--success" role="status"><div className="notice__body">{notice}</div></div>}
      {error && <div className="notice notice--error" role="alert"><div className="notice__body">{error}</div></div>}

      <div className="notice notice--info">
        <span className="notice__icon"><ShieldCheck size={18} aria-hidden="true" /></span>
        <div className="notice__body"><div className="notice__title">Authorisation note</div>Every approval action is enforced by backend permissions before an offer can be issued.</div>
      </div>

      <div className="ta-interview-summary">
        <div className="ta-interview-summary__item"><span className="ta-interview-summary__label">Pending approval</span><span className="ta-interview-summary__value">{counts.pending}</span></div>
        <div className="ta-interview-summary__item"><span className="ta-interview-summary__label">Offers prepared</span><span className="ta-interview-summary__value">{counts.approved}</span></div>
        <div className="ta-interview-summary__item"><span className="ta-interview-summary__label">Total selected</span><span className="ta-interview-summary__value">{counts.all}</span></div>
        <div className="ta-interview-summary__item"><span className="ta-interview-summary__label">Awaiting offer</span><span className="ta-interview-summary__value">{counts.pending}</span></div>
      </div>

      <div className="page-toolbar"><div className="search-box"><span className="search-box__icon"><UsersRound size={16} aria-hidden="true" /></span><input type="search" className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by candidate, application ID or position" aria-label="Search the approval queue" /></div><div className="filters"><button type="button" className={`ta-filter-chip ${statusFilter === "pending" ? "active" : ""}`} onClick={() => setStatusFilter("pending")}>Pending <span className="ta-filter-chip__count">{counts.pending}</span></button><button type="button" className={`ta-filter-chip ${statusFilter === "approved" ? "active" : ""}`} onClick={() => setStatusFilter("approved")}>Approved <span className="ta-filter-chip__count">{counts.approved}</span></button><button type="button" className={`ta-filter-chip ${statusFilter === "all" ? "active" : ""}`} onClick={() => setStatusFilter("all")}>All <span className="ta-filter-chip__count">{counts.all}</span></button></div></div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        loading={loading}
        empty={<EmptyState icon={UserCheck} title="No approvals match this view" description="Selected candidates appear here after the hiring evaluation is recorded." action={<Link className="btn btn--outline btn--sm" to="/hr/final-selection">Review hiring evaluation</Link>} />}
        footer={<><span>Showing <strong>{filtered.length}</strong> approval record{filtered.length === 1 ? "" : "s"}</span><span className="cell-muted">HR selects here; offer creation starts the candidate-facing flow</span></>}
      />

      <Modal
        open={Boolean(review)}
        onClose={closeReview}
        title={review ? `Approval · ${review.candidate?.fullName}` : "Approval"}
        subtitle={review ? `${review.jobOpening?.title} · ${review.applicationCode}` : undefined}
        size="xl"
        footer={review ? (
          <>
            {app?.resumeFileId && <Button variant="outline" icon={FileSearch} onClick={() => void openFile(app.resumeFileId)} disabled={previewing}>Preview CV</Button>}
            <Button variant="outline" onClick={closeReview} disabled={busy}>Close</Button>
            {!isApproved && !rejecting && (
              <>
                <Button variant="outline" onClick={() => { if (window.confirm("Place this application on hold?")) void changeStatus(review.id, "ON_HOLD", "Placed on hold during admin approval."); }} loading={busy}>Hold</Button>
                <Button variant="danger-ghost" icon={XCircle} onClick={() => setRejecting(true)}>Reject</Button>
                <Button icon={ShieldCheck} onClick={() => void selectCandidate(review)}>Select candidate</Button>
              </>
            )}
            {isApproved && !offerExistsForReview && (
              <Button icon={CheckCircle2} onClick={() => navigate(`/hr/offers?applicationId=${review.id}&ctc=${approvalOffered || reviewDetail?.finalSelectionSalary || review?.finalSelectionSalary || ""}`)}>Create Offer</Button>
            )}
            {rejecting && (
              <>
                <Button variant="outline" onClick={() => setRejecting(false)} disabled={busy}>Back</Button>
                <Button variant="danger" onClick={() => changeStatus(review.id, "REJECTED", rejectionReason.trim() || undefined)} loading={busy}>Confirm rejection</Button>
              </>
            )}
          </>
        ) : undefined}
      >
        {app && (
          <div className="ta-profile-grid">
            <section className="card ta-profile-main">
              <div className="card__header">
                <div>
                  <div className="card__title">Personal information</div>
                  <div className="card__subtitle">Details submitted with the application</div>
                </div>
                <CandidateStatusBadge status={app.status} />
              </div>
              <div className="card__body">
                <div className="detail-grid detail-grid--3">
                  <div className="detail-item"><div className="detail-item__label">Candidate ID</div><div className="detail-item__value">{candidate?.candidateCode || "—"}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Application ID</div><div className="detail-item__value">{app.applicationCode}</div></div>
                  <div className="detail-item"><div className="detail-item__label">Position</div><div className="detail-item__value">{job?.title || "—"}</div></div>
                  <div className="detail-item"><div className="detail-item__label"><Mail size={12} aria-hidden="true" /> Email</div><div className="detail-item__value">{candidate?.email}</div></div>
                  <div className="detail-item"><div className="detail-item__label"><Phone size={12} aria-hidden="true" /> Phone</div><div className="detail-item__value">{candidate?.mobile || "—"}</div></div>
                  <div className="detail-item"><div className="detail-item__label"><MapPin size={12} aria-hidden="true" /> Location</div><div className="detail-item__value">{candidate?.currentLocation || "—"}</div></div>
                </div>
                {isApproved && <div className="notice notice--success" style={{ marginTop: "1rem" }}><div className="notice__body"><div className="notice__title">Selected for offer</div><div>HR has approved this candidate for the offer letter stage. Create the offer now.</div></div></div>}
                {rejecting && <div className="field" style={{ marginTop: "1rem" }}><label className="field__label" htmlFor="approval-reject-reason">Reason for rejection <span className="field__optional">(optional)</span></label><textarea id="approval-reject-reason" className="textarea" rows={3} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Tell HR why this candidate cannot be approved…" /></div>}
              </div>
            </section>

            <section className="card">
              <div className="card__header">
                <div><div className="card__title">Approval details &amp; HR feedback</div><div className="card__subtitle">Visible to every approver and included in the approval audit.</div></div>
                <Button size="sm" variant="outline" onClick={() => void saveApprovalRecommendation()} loading={savingApproval}>Save details</Button>
              </div>
              <div className="card__body">
                <div className="form-grid">
                  <Input label="Offered salary (annual CTC)" type="number" min={0} value={approvalOffered} onChange={(event) => setApprovalOffered(event.target.value)} placeholder="e.g. 1200000" inputMode="numeric" />
                  <Input label="Candidate expected salary" type="number" min={0} value={approvalExpected} onChange={(event) => setApprovalExpected(event.target.value)} placeholder="Optional" inputMode="numeric" />
                  <Input label="AI score" type="number" min={0} max={100} step="0.1" value={approvalAiScore} onChange={(event) => setApprovalAiScore(event.target.value)} placeholder="e.g. 82" />
                  <div className="field field--full">
                    <Textarea label="HR feedback / screening remarks" value={approvalFeedback} onChange={(event) => setApprovalFeedback(event.target.value)} placeholder="Record the screening outcome, strengths, concerns or conditions…" rows={3} />
                  </div>
                </div>
                <div className="detail-item" style={{ marginTop: "0.75rem" }}>
                  <div className="detail-item__label">Position</div>
                  <div className="detail-item__value">{job?.title || "—"}</div>
                </div>
                <div className="detail-item" style={{ marginTop: "0.5rem" }}>
                  <div className="detail-item__label">Department</div>
                  <div className="detail-item__value">{job?.department?.name || "—"}</div>
                </div>
                <div className="detail-item" style={{ marginTop: "0.5rem" }}>
                  <div className="detail-item__label">Offer status</div>
                  <div className="detail-item__value">{offerExistsForReview ? "Offer prepared" : "No offer prepared"}</div>
                </div>
              </div>
             </section>

             {interviewFeedbackLogs.length > 0 && (
               <section className="card" style={{ marginTop: "1rem" }}>
                 <div className="card__header"><div><div className="card__title">Interview feedback</div><div className="card__subtitle">HR feedback sent with the final hiring evaluation</div></div><Badge variant="blue">{interviewFeedbackLogs.length} round{interviewFeedbackLogs.length === 1 ? "" : "s"}</Badge></div>
                 <div className="card__body">
                   <ul className="ta-detail-list">
                     {interviewFeedbackLogs.map((interview: any) => (
                       <li className="ta-detail-list__item" key={interview.id}>
                         <div className="ta-detail-list__title">{interview.round} · {interview.interviewer}</div>
                         <div className="ta-detail-list__meta">{interview.scheduledAt ? formatDateTime(interview.scheduledAt) : "Scheduled time not provided"}{interview.score ? ` · Rating ${interview.score}/5` : " · Rating pending"}</div>
                         {interview.recommendation && <div className="ta-detail-list__meta">Recommendation: {String(interview.recommendation).replace(/_/g, " ")}</div>}
                         {interview.feedback && <p className="ta-detail-list__text">{interview.feedback}</p>}
                       </li>
                     ))}
                   </ul>
                 </div>
               </section>
             )}
           </div>
         )}

        {candidate?.skills?.length > 0 && <section className="card" style={{ marginTop: "1rem" }}><div className="card__header"><div><div className="card__title">Skills</div><div className="card__subtitle">Submitted with the application</div></div></div><div className="card__body"><div className="ta-chip-list">{candidate.skills.map((record: any, index: number) => <span className="ta-chip" key={record.id || index}>{record.skill?.name || String(record)}</span>)}</div></div></section>}

        {(edu.length > 0 || history.length > 0 || certs.length > 0) && (
          <div className="ta-profile-grid" style={{ marginTop: "1rem" }}>
            {edu.length > 0 && <section className="card"><div className="card__header"><div><div className="card__title">Education</div><div className="card__subtitle">Degree, institution and year</div></div><GraduationCap size={18} aria-hidden="true" /></div><div className="card__body"><ul className="ta-detail-list">{edu.map((item: any) => <li className="ta-detail-list__item" key={item.id}><div className="ta-detail-list__title">{item.degree}</div><div className="ta-detail-list__meta">{item.institution}{item.field ? ` · ${item.field}` : ""}{item.endYear ? ` · ${item.endYear}` : ""}</div></li>)}</ul></div></section>}
            {history.length > 0 && <section className="card"><div className="card__header"><div><div className="card__title">Professional experience</div><div className="card__subtitle">Previous roles</div></div><Briefcase size={18} aria-hidden="true" /></div><div className="card__body"><ul className="ta-detail-list">{history.map((item: any) => <li className="ta-detail-list__item" key={item.id}><div className="ta-detail-list__title">{item.title || "Role"} · {item.organization}</div><div className="ta-detail-list__meta">{item.startDate ? new Date(item.startDate).getFullYear() : ""}{item.endDate ? ` → ${new Date(item.endDate).getFullYear()}` : " → Present"}</div>{item.description && <p className="ta-detail-list__text">{item.description}</p>}</li>)}</ul></div></section>}
          </div>
        )}

        {certs.length > 0 && <section className="card" style={{ marginTop: "1rem" }}><div className="card__header"><div><div className="card__title">Certifications</div><div className="card__subtitle">Certificates claimed</div></div><BadgeCheck size={18} aria-hidden="true" /></div><div className="card__body"><ul className="ta-detail-list">{certs.map((item: any) => <li className="ta-detail-list__item" key={item.id}><div className="ta-detail-list__title">{item.name}</div><div className="ta-detail-list__meta">{item.issuer}{item.issuedAt ? ` · ${new Date(item.issuedAt).getFullYear()}` : ""}</div></li>)}</ul></div></section>}

        {documents.length > 0 && <section className="card" style={{ marginTop: "1rem" }}><div className="card__header"><div><div className="card__title">CV and documents</div><div className="card__subtitle">Profile, resume and submitted files</div></div><span className="badge badge--blue">{documents.length} file{documents.length === 1 ? "" : "s"}</span></div><div className="card__body"><ul className="ta-detail-list">{documents.map((doc: any) => <li className="ta-detail-list__item" key={doc.id}><div className="ta-detail-list__title">{doc.category?.name || "Document"}</div><div className="ta-detail-list__meta">{doc.status}{doc.fileId && <button type="button" className="ta-link" onClick={() => void openFile(doc.fileId)}>Preview</button>}</div></li>)}</ul></div></section>}

        {timeline.length > 0 && <section className="card" style={{ marginTop: "1rem" }}><div className="card__header"><div><div className="card__title">Recruitment timeline</div><div className="card__subtitle">Every recorded transition</div></div></div><div className="card__body"><ol className="ta-timeline">{timeline.map((entry: any, index: number) => <li className="ta-timeline__item" key={`${entry.id || index}-${index}`}><span className="ta-timeline__dot" aria-hidden="true" /><div className="ta-timeline__body"><div className="ta-timeline__event">{entry.toStatus}{entry.fromStatus && <span className="ta-timeline__transition">{' '}{entry.fromStatus.replace(/_/g, " ")} → {entry.toStatus.replace(/_/g, " ")}</span>}</div><div className="ta-timeline__meta">{formatDateTime(entry.createdAt)}{entry.changedBy?.email ? ` · ${entry.changedBy.email}` : ""}</div>{entry.remarks && <div className="ta-timeline__note">{entry.remarks}</div>}</div></li>)}</ol></div></section>}
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
