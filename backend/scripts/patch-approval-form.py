from pathlib import Path

p = Path("D:/t-a-p/emc-hr/emc-carrer/frontend/src/pages/hr/Approvals.tsx")
s = p.read_text(encoding="utf-8")
start_marker = '''            <section className="card">
              <div className="card__header"><div><div className="card__title">Hiring recommendation</div><div className="card__subtitle">Salary and screening details recorded by HR</div></div></div>'''
end_marker = '''             </section>

             {interviewFeedbackLogs.length > 0 && ('''
start = s.find(start_marker)
end = s.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit((start, end))
replacement = '''            <section className="card">
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

'''
s = s[:start] + replacement + s[end:]
s = s.replace('onClick={() => selectCandidate(review)}', 'onClick={() => void selectCandidate(review)}')
s = s.replace('ctk=${reviewDetail?.finalSelectionSalary ?? review.finalSelectionSalary ?? ""}', 'ctk=${approvalOffered || reviewDetail?.finalSelectionSalary || review?.finalSelectionSalary || ""}')
p.write_text(s, encoding="utf-8")
print("patched")
