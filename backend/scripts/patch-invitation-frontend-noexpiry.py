from pathlib import Path

f = Path("D:/t-a-p/emc-hr/emc-carrer/frontend/src/pages/hr/databank/InvitationFormModal.tsx")
s = f.read_text(encoding="utf-8")
s = s.replace('<span className="field__hint">Link expires {new Date(result.expiresAt).toLocaleString()}.</span>', '<span className="field__hint">This link never expires.</span>')
f.write_text(s, encoding="utf-8")

f = Path("D:/t-a-p/emc-hr/emc-carrer/frontend/src/pages/hr/databank/InvitationProgressModal.tsx")
s = f.read_text(encoding="utf-8")
s = s.replace('<span>Invitation expires: <strong>{formatDateTime(invitation.expiresAt)}</strong></span>', '<span>Invitation link: <strong>Never expires</strong></span>')
f.write_text(s, encoding="utf-8")

f = Path("D:/t-a-p/emc-hr/emc-carrer/frontend/src/pages/hr/databank/InvitationsView.tsx")
s = f.read_text(encoding="utf-8")
s = s.replace('  { value: "EXPIRED", label: "Expired" },\n', '')
s = s.replace('  EXPIRED: { label: "Expired", variant: "red" },\n', '')
s = s.replace('  if (inv.status === "EXPIRED") return "renew";\n', '')
s = s.replace('<div className="cell-muted">Exp. {formatDate(inv.expiresAt)}</div>', '<div className="cell-muted">Link never expires</div>')
s = s.replace('<div className="detail-item__label">Expires</div><div className="detail-item__value">{formatDateTime(viewing.expiresAt)}</div>', '<div className="detail-item__label">Link Validity</div><div className="detail-item__value">Never expires</div>')
f.write_text(s, encoding="utf-8")
print("frontend patched")
