import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Eye, RefreshCw, Search, Send } from "lucide-react";
import { hrApi } from "../../lib/api";
import PageHeader from "../../components/ref/PageHeader";
import Button from "../../components/ref/Button";
import Badge from "../../components/ref/Badge";
import Modal from "../../components/ref/Modal";
import CandidateStatusBadge from "../../components/ref/CandidateStatusBadge";
import EmptyState from "../../components/ref/EmptyState";
import DataTable, { type Column } from "../../components/DataTable";
import { Select, Input, Textarea } from "../../components/ref/Input";
import { initials, formatDate, formatDateTime } from "./databank/shared";

type Decision = "SELECTED" | "ON_HOLD" | "REJECTED";

const DECISION_OPTIONS: Array<{ value: Decision; label: string; variant: "green" | "grey" | "red" }> = [
  { value: "SELECTED", label: "Hire the candidate", variant: "green" },
  { value: "ON_HOLD", label: "On hold", variant: "grey" },
  { value: "REJECTED", label: "Reject the candidate", variant: "red" },
];

export default function FinalSelection() {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [review, setReview] = useState<any>(null);
  const [decision, setDecision] = useState<Decision>("SELECTED");
  const [remarks, setRemarks] = useState("");
  const [offeredSalary, setOfferedSalary] = useState("");
  const [expectedSalary, setExpectedSalary] = useState("");
  const [finalNote, setFinalNote] = useState("");
  const [remarkError, setRemarkError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [positionId, setPositionId] = useState("");
  const [positions, setPositions] = useState<any[]>([]);
  const [error, setError] = useState("");

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [completed, selected, interviewList, openings] = await Promise.all([
        hrApi.applications({ page: 1, pageSize: 100, status: "INTERVIEW_COMPLETED", jobOpeningId: positionId || undefined }).then((r: any) => r?.data?.items ?? []),
        hrApi.applications({ page: 1, pageSize: 100, status: "SELECTED", jobOpeningId: positionId || undefined }).then((r: any) => r?.data?.items ?? []),
        hrApi.interviews({ page: 1, pageSize: 200, jobOpeningId: positionId || undefined }).then((r: any) => r?.data?.items ?? r?.data ?? []),
        hrApi.openings({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? []),
      ]);
      setItems([...completed, ...selected]);
      setInterviews(Array.isArray(interviewList) ? interviewList : []);
      setPositions(Array.isArray(openings) ? openings : []);
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not load final selection candidates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const latestResult = (application: any) => {
    const list = interviews.filter((item: any) => item.applicationId === application.id || item.application?.id === application.id);
    const withOutcome = list.filter((item: any) => {
      const fb = Array.isArray(item.feedback) ? item.feedback[item.feedback.length - 1] : item.feedback;
      return fb && (fb.result || fb.recommendation);
    });
    return withOutcome.length || null;
  };

  const candidates = items.map((application: any) => {
    const list = interviews.filter((item: any) => item.applicationId === application.id || item.application?.id === application.id);
    return { ...application, _interviews: list, _results: latestResult(application) };
  });

  const counts = {
    pending: candidates.filter((item: any) => item.status === "INTERVIEW_COMPLETED").length,
    submitted: candidates.filter((item: any) => item.status === "SELECTED").length,
    all: candidates.length,
  };

  const needle = search.trim().toLowerCase();
  const visible = candidates.filter((item: any) => (!positionId || item.jobOpeningId === positionId) && (!needle || [item.applicationCode, item.candidate?.fullName, item.candidate?.email, item.jobOpening?.title].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle))));

  const openReview = (entry: any) => {
    setReview(entry);
    setDecision(entry.status === "SELECTED" ? "SELECTED" : "SELECTED");
    setRemarks("");
    setOfferedSalary(entry.finalSelectionSalary != null ? String(entry.finalSelectionSalary) : "");
    setExpectedSalary(entry.finalSelectionExpectedSalary != null ? String(entry.finalSelectionExpectedSalary) : "");
    setFinalNote(entry.finalSelectionNote ?? "");
    setRemarkError("");
  };

  const submitDecision = async (submit = false) => {
    if (!review) return;
    const currentIndex = visible.findIndex((item) => item.id === review.id);
    const nextCandidate = currentIndex >= 0 ? visible[currentIndex + 1] : undefined;
    const text = remarks.trim();
    const salary = offeredSalary.trim();
    const expected = expectedSalary.trim();
    const parseAmount = (value: string) => {
      const cleaned = value.replace(/[₹,\s]/g, "").replace(/^rs\.?/i, "").replace(/^inr/i, "");
      const num = Number(cleaned);
      return Number.isFinite(num) ? num : undefined;
    };
    const salaryValue = parseAmount(salary);
    const expectedValue = expected ? parseAmount(expected) : undefined;
    const decidingStatus: Decision = submit ? "SELECTED" : decision;
    if (salary && salaryValue === undefined) { setRemarkError("Enter a valid offered salary (numbers and commas only)."); return; }
    if (expected && expectedValue === undefined) { setRemarkError("Enter a valid expected salary (numbers and commas only)."); return; }
    if (submit && !salary) { setRemarkError("Enter the offered salary before submitting for admin approval."); return; }
    if (submit && salaryValue === undefined) { setRemarkError("Enter a valid offered salary before submitting for admin approval."); return; }
    if (decidingStatus === "SELECTED" && !salary) { setRemarkError("Enter the offered salary before selecting the candidate."); return; }
    if (decidingStatus === "SELECTED" && salaryValue === undefined) { setRemarkError("Enter a valid offered salary before selecting the candidate."); return; }
    if (!text && submit) {
      setRemarkError("Record the hiring recommendation before submitting for admin approval.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const status: Decision = submit ? "SELECTED" : decision;
      await hrApi.applicationStatus(review.id, { status, remarks: text || "Submitted for admin approval.", finalSelectionSalary: salaryValue ?? null, finalSelectionExpectedSalary: expectedValue ?? null, finalSelectionNote: finalNote.trim() || null });
      setNotice(submit ? "Candidate submitted to the admin approval stage." : "Hiring decision recorded.");
      setRemarks("");
      setOfferedSalary("");
      setExpectedSalary("");
      setFinalNote("");
      if (nextCandidate && nextCandidate.id !== review.id) {
        await Promise.all([load(true), Promise.resolve(openReview(nextCandidate))]);
      } else {
        await load(true);
        setReview(null);
        if (submit) navigate("/hr/approvals");
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not record the hiring decision.");
    } finally {
      setBusy(false);
    }
  };

  const decisionLabel = (status: string) => {
    if (status === "SELECTED") return { label: "Hire the candidate", variant: "green" as const };
    if (status === "ON_HOLD") return { label: "On hold", variant: "grey" as const };
    return { label: "Reject the candidate", variant: "red" as const };
  };

  const columns: Column<any>[] = [
    { key: "candidate", header: "Candidate", render: (row) => <div className="cell-user"><div className="avatar">{initials(row.candidate?.fullName || "")}</div><div className="cell-user__text"><div className="cell-user__name">{row.candidate?.fullName}</div><div className="cell-user__sub">{row.applicationCode}</div></div></div> },
    { key: "position", header: "Position", render: (row) => row.jobOpening?.title || "—" },
    { key: "interviews", header: "Interviews", render: (row) => <span>{row._interviews.length} round{row._interviews.length === 1 ? "" : "s"}</span> },
    { key: "results", header: "Interview results", render: (row) => row._results ? <span className="cell-strong">{row._results} recorded</span> : <span className="cell-muted">Pending</span> },
    { key: "screening", header: "Screening", render: (row) => row.aiMatchScore != null ? <span className="cell-strong">{Math.round(Number(row.aiMatchScore))}%</span> : <span className="cell-muted">Not scored</span> },
    { key: "decision", header: "HR decision", render: (row) => { if (row.status === "SELECTED") return row.adminApprovedAt ? <Badge variant="green" dot>Admin approved — ready for offer</Badge> : <Badge variant="blue" dot>Submitted for admin approval</Badge>; const meta = decisionLabel(row.status); return <Badge variant={meta.variant} dot>{meta.label}</Badge>; } },
    { key: "decidedAt", header: "Decided on", render: (row) => <span className="cell-muted">{formatDate(row.updatedAt)}</span> },
    { key: "actions", header: "Actions", className: "text-right", render: (row) => <div className="cell-actions"><button type="button" className="btn btn--ghost btn--icon" onClick={() => openReview(row)} title="Review evaluation" aria-label="Review evaluation"><Eye size={16} /></button>{row.status === "INTERVIEW_COMPLETED" && <button type="button" className="btn btn--ghost btn--icon" onClick={() => openReview(row)} title="Open for admin approval" aria-label="Open for admin approval"><Send size={16} /></button>}{row.status === "SELECTED" && row.adminApprovedAt && <button type="button" className="btn btn--outline btn--icon" onClick={() => navigate(`/hr/offers?applicationId=${row.id}&ctc=${row.finalSelectionSalary ?? ""}`)} title="Send to Offer Letter" aria-label="Send to Offer Letter"><Send size={16} /></button>}{row.status === "SELECTED" && !row.adminApprovedAt && <CheckCircle2 size={16} className="ta-icon-success" aria-hidden="true" />}</div> },
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Ecometrix · Talent Acquisition"
        title="Hiring Evaluation"
        subtitle="HR evaluation of the candidates that completed their interview rounds. Record the hiring recommendation and submit it for admin approval."
        actions={<Button variant="outline" icon={RefreshCw} onClick={() => void load(true)}>Refresh data</Button>}
      />

      {notice && <div className="notice notice--success" role="status"><div className="notice__body">{notice}</div></div>}
      {error && <div className="notice notice--error" role="alert"><div className="notice__body">{error}</div></div>}

      <div className="ta-interview-summary">
        <div className="ta-interview-summary__item"><span className="ta-interview-summary__label">Awaiting decision</span><span className="ta-interview-summary__value">{counts.pending}</span></div>
        <div className="ta-interview-summary__item"><span className="ta-interview-summary__label">Submitted for approval</span><span className="ta-interview-summary__value">{counts.submitted}</span></div>
        <div className="ta-interview-summary__item"><span className="ta-interview-summary__label">Candidates in scope</span><span className="ta-interview-summary__value">{counts.all}</span></div>
      </div>

      <div className="page-toolbar page-toolbar--row"><Select aria-label="Position" value={positionId} onChange={(event) => setPositionId(event.target.value)} options={positions.map((o: any) => ({ value: o.id, label: `${o.title} (${o.jobCode ?? ""})` }))} placeholder="All positions" /><div className="search-box"><span className="search-box__icon"><Search size={16} aria-hidden="true" /></span><input type="search" className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by candidate, application ID or position" aria-label="Search the final selection list" /></div></div>

      <DataTable
        columns={columns}
        rows={visible}
        rowKey={(row) => row.id}
        loading={loading}
        empty={<EmptyState icon={CheckCircle2} title="No candidates in the final selection stage" description="Candidates appear here once their interview rounds are completed." />}
        footer={<><span>Showing <strong>{visible.length}</strong> candidate{visible.length === 1 ? "" : "s"}</span><span className="cell-muted">Only the final decision moves these candidates to approval</span></>}
      />

      <Modal
        open={Boolean(review)}
        onClose={() => (busy ? undefined : setReview(null))}
        title={review ? `Final selection · ${review.candidate?.fullName}` : "Final selection"}
        subtitle={review ? `${review.jobOpening?.title} · ${review.applicationCode}` : undefined}
        size="xl"
        footer={review ? (
          <>
            <span className="modal__footer-note">The HR decision is submitted to the admin approval stage separately.</span>
            <Button variant="outline" onClick={() => setReview(null)} disabled={busy}>Close</Button>
            {review.status === "SELECTED" && !review.adminApprovedAt && <CheckCircle2 size={16} className="ta-icon-success" aria-hidden="true" />}
            {review.status === "SELECTED" && Boolean(review.adminApprovedAt) && <Button onClick={() => navigate(`/hr/offers?applicationId=${review.id}&ctc=${review.finalSelectionSalary ?? ""}`)} icon={Send}>Send to Offer Letter</Button>}
            {review.status === "INTERVIEW_COMPLETED" && <Button variant="secondary" onClick={() => void submitDecision(true)} loading={busy}>Submit for Admin Approval</Button>}
            <Button onClick={() => void submitDecision(false)} loading={busy}>Record decision</Button>
          </>
        ) : undefined}
      >
        {review && (
          <div className="ta-screening-layout ta-final-layout">
            <div className="ta-screening-layout__main ta-final-layout__main">
              <section className="ta-panel"><div className="ta-panel__header">Candidate evaluation</div><div className="detail-grid detail-grid--3"><div className="detail-item"><div className="detail-item__label">Position</div><div className="detail-item__value">{review.jobOpening?.title || "—"}</div></div><div className="detail-item"><div className="detail-item__label">Screening score</div><div className="detail-item__value">{review.aiMatchScore != null ? `${Math.round(Number(review.aiMatchScore))}%` : "Not scored"}</div></div><div className="detail-item"><div className="detail-item__label">Admin approval</div><div className="detail-item__value">{review.adminApprovedAt ? `Approved ${formatDate(review.adminApprovedAt)}` : "Pending admin decision"}</div></div></div></section>
              <section className="ta-panel"><div className="ta-panel__header">Interview feedback</div>{review._interviews.length === 0 ? <p className="detail-item__value detail-item__value--muted">No interview feedback has been recorded.</p> : <ul className="ta-detail-list">{review._interviews.map((interview: any) => (<li className="ta-detail-list__item" key={interview.id}><div className="ta-detail-list__title">{interview.round} · {interview.interviewerName || "Interviewer"}</div><div className="ta-detail-list__meta">{formatDateTime(interview.scheduledAt)}</div>{Array.isArray(interview.feedback) && interview.feedback.length > 0 && <><div className="ta-detail-list__meta">Result: {String(interview.feedback[0].result ? ({ GOOD: "Good", BEST: "Best", NOT_SATISFIED: "Not satisfied" } as any)[interview.feedback[0].result] ?? interview.feedback[0].result : "—")}{interview.feedback[0].recommendation ? ` · Outcome: ${String(interview.feedback[0].recommendation).replace(/_/g, " ")}` : ""}</div><p className="ta-detail-list__text">{interview.feedback[0].feedback || "—"}</p></>}</li>))}</ul>}</section>
              <section className="ta-panel"><div className="ta-panel__header">HR decision</div><div className="form-grid"><div className="field field--full"><span className="field__label">Final recommendation</span><div className="ta-choice-row">{DECISION_OPTIONS.map((option) => <button type="button" key={option.value} className={`ta-choice ${decision === option.value ? "active" : ""}`} onClick={() => setDecision(option.value)} aria-pressed={decision === option.value}>{option.label}</button>)}</div></div><Input label="Offered salary (annual CTC)" type="number" min={0} value={offeredSalary} onChange={(event) => setOfferedSalary(event.target.value)} placeholder="e.g. 1200000" required={decision === "SELECTED"} error={remarkError} /><Input label="Candidate expected salary" type="number" min={0} value={expectedSalary} onChange={(event) => setExpectedSalary(event.target.value)} placeholder="Optional" /><div className="field field--full"><Textarea label="Final note" value={finalNote} onChange={(event) => setFinalNote(event.target.value)} placeholder="Candidate negotiation or decision note" /></div><div className="field field--full"><Textarea label="Decision remarks" required value={remarks} error={remarkError} onChange={(event) => { setRemarks(event.target.value); if (remarkError) setRemarkError(""); }} placeholder="Summarise the hiring recommendation" /></div></div></section>
            </div>
            <aside className="ta-screening-layout__side ta-final-layout__side"><div className="ta-panel"><div className="ta-panel__header">Current state</div><div className="detail-grid"><div className="detail-item"><div className="detail-item__label">Application stage</div><div className="detail-item__value"><CandidateStatusBadge status={review.status} /></div></div><div className="detail-item"><div className="detail-item__label">Decision recorded</div><div className="detail-item__value">{review.updatedAt ? formatDate(review.updatedAt) : "Not recorded"}</div></div><div className="detail-item"><div className="detail-item__label">Approval state</div><div className="detail-item__value">{review.status === "SELECTED" ? (review.adminApprovedAt ? `Admin approved ${formatDate(review.adminApprovedAt)}` : "Submitted for admin approval") : "Not submitted"}</div></div></div></div></aside>
          </div>
        )}
      </Modal>
    </div>
  );
}
