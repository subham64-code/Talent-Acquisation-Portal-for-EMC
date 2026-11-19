from pathlib import Path
p = Path("D:/t-a-p/emc-hr/emc-carrer/frontend/src/pages/hr/Submissions.tsx")
s = p.read_text(encoding="utf-8")
start = s.index("  const columns: Column<any>[] = [")
end = s.index("  ];\n\n  return (", start)
new = """  const columns: Column<any>[] = [
    {
      key: "candidate",
      header: "Candidate",
      className: "col-candidate",
      render: (a) => (
        <div className="cell-user">
          <div className="avatar">{initials(a.candidate?.fullName || "")}</div>
          <div className="cell-user__text">
            <button type="button" className="ta-link cell-user__name" onClick={() => void openDetail(a)} aria-label={`Open the application of ${a.candidate?.fullName}`}>{a.candidate?.fullName}</button>
            <div className="cell-user__sub">{a.candidate?.candidateCode || "No candidate ID"} · {a.candidate?.email}</div>
          </div>
        </div>
      ),
    },
    { key: "application", header: "Application ID", className: "col-application", render: (a) => <div className="cell-stack"><strong>{a.applicationCode}</strong><span className="cell-muted">Applied {formatDate(a.appliedAt)}</span></div> },
    { key: "email", header: "Email", className: "col-email", render: (a) => <span className="cell-ellipsis" title={a.candidate?.email}>{a.candidate?.email}</span> },
    { key: "phone", header: "Phone", className: "col-phone", render: (a) => <span className="cell-nowrap">{a.candidate?.mobile || "—"}</span> },
    { key: "position", header: "Position", className: "col-position", render: (a) => <div className="cell-stack"><strong>{a.jobOpening?.title}</strong><span className="cell-muted">{a.jobOpening?.department?.name || "—"}</span></div> },
    { key: "experience", header: "Exp.", className: "col-compact", render: (a) => <span className="cell-nowrap">{a.candidate?.totalExperience != null ? `${a.candidate.totalExperience} yrs` : "—"}</span> },
    { key: "location", header: "Location", className: "col-location", render: (a) => <span className="cell-ellipsis" title={a.candidate?.currentLocation}>{a.candidate?.currentLocation || "—"}</span> },
    { key: "qualification", header: "Qualification", className: "col-qualification", render: (a) => <span className="cell-ellipsis" title={a.candidate?.qualification}>{a.candidate?.qualification || "—"}</span> },
    { key: "status", header: "Status", className: "col-status", render: (a) => <CandidateStatusBadge status={a.status} /> },
    { key: "ai", header: "AI Score", className: "col-compact", render: (a) => a.aiMatchScore != null ? <span className="cell-strong">{Math.round(a.aiMatchScore)}%</span> : <span className="cell-muted">—</span> },
    {
      key: "actions",
      header: "Actions",
      className: "text-right col-actions",
      render: (a) => (
        <div className="cell-actions cell-actions--nowrap">
          <button type="button" className="btn btn--ghost btn--icon" title="View all details" aria-label="View all details" onClick={() => void openDetail(a)}><Eye size={16} /></button>
          {a.resumeFileId && <button type="button" className="btn btn--ghost btn--icon" title="Preview CV" aria-label="Preview CV" onClick={() => void openResume(a.resumeFileId)} disabled={cvBusy}><FileSearch size={16} /></button>}
          {a.status === "APPLIED" && <button type="button" className="btn btn--ghost btn--icon" title="Move to screening" aria-label="Move to screening" onClick={() => setScreening(a)}><MoveRight size={16} /></button>}
          <button type="button" className="btn btn--ghost btn--icon" title="Add HR remark" aria-label="Add remark" onClick={() => { setRemarking(a); setRemark(""); }}><MessageSquarePlus size={16} /></button>
          <button type="button" className="btn btn--danger-ghost btn--icon" title="Reject application" aria-label="Reject application" onClick={() => setRejecting(a)}><XCircle size={16} /></button>
        </div>
      ),
    },
"""
p.write_text(s[:start] + new + s[end:], encoding="utf-8")
print("columns patched")
