from pathlib import Path

p = Path("D:/t-a-p/emc-hr/emc-carrer/frontend/src/pages/hr/Submissions.tsx")
s = p.read_text(encoding="utf-8")
start = s.index("  const columns: Column<any>[] = [")
end = s.index("  ];\n\n  return (", start)
new = """  const columns: Column<any>[] = [
    {
      key: "candidate",
      header: "Candidate",
      render: (a) => (
        <div className="cell-user">
          <div className="avatar">{initials(a.candidate?.fullName || "")}</div>
          <div className="cell-user__text">
            <button type="button" className="ta-link cell-user__name" onClick={() => void openDetail(a)} aria-label={`Open the application of ${a.candidate?.fullName}`}>{a.candidate?.fullName}</button>
            <div className="cell-user__sub">{a.candidate?.candidateCode || "Candidate"} · {a.candidate?.email}</div>
          </div>
        </div>
      ),
    },
    { key: "application", header: "Application", className: "col-application", render: (a) => <div className="cell-stack"><strong>{a.applicationCode}</strong><span className="cell-muted">{formatDate(a.appliedAt)}</span></div> },
    { key: "position", header: "Position", className: "col-position", render: (a) => <div className="cell-stack"><strong>{a.jobOpening?.title}</strong><span className="cell-muted">{a.jobOpening?.department?.name || "—"}</span></div> },
    { key: "experience", header: "Exp.", className: "col-compact", render: (a) => <span className="cell-muted">{a.candidate?.totalExperience != null ? `${a.candidate.totalExperience} yrs` : "—"}</span> },
    { key: "status", header: "Status", className: "col-status", render: (a) => <CandidateStatusBadge status={a.status} /> },
    { key: "ai", header: "AI Score", className: "col-compact", render: (a) => a.aiMatchScore != null ? <span className="cell-strong">{Math.round(a.aiMatchScore)}%</span> : <span className="cell-muted">—</span> },
    {
      key: "actions",
      header: "Actions",
      className: "text-right col-actions",
      render: (a) => (
        <div className="cell-actions cell-actions--nowrap">
          <button type="button" className="btn btn--ghost btn--icon" title="View details" aria-label="View details" onClick={() => void openDetail(a)}><Eye size={16} /></button>
          {a.resumeFileId && <button type="button" className="btn btn--ghost btn--icon" title="Preview CV" aria-label="Preview CV" onClick={() => void openResume(a.resumeFileId)} disabled={cvBusy}><FileSearch size={16} /></button>}
          {a.status === "APPLIED" && <button type="button" className="btn btn--ghost btn--icon" title="Move to screening" aria-label="Move to screening" onClick={() => setScreening(a)}><MoveRight size={16} /></button>}
          {a.status !== "REJECTED" && a.status !== "SELECTED" && (
            <button type="button" className="btn btn--ghost btn--icon" title="Add HR remark" aria-label="Add remark" onClick={() => { setRemarking(a); setRemark(""); }}><MessageSquarePlus size={16} /></button>
          )}
          <button type="button" className="btn btn--danger-ghost btn--icon" title="Reject application" aria-label="Reject application" onClick={() => setRejecting(a)}><XCircle size={16} /></button>
        </div>
      ),
    },
"""
p.write_text(s[:start] + new + s[end:], encoding="utf-8")
print("patched", start, end)
