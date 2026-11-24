import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import Modal from "../../../components/ref/Modal";
import Button from "../../../components/ref/Button";
import Badge from "../../../components/ref/Badge";
import { formatDate, initials, employeeStatusMeta } from "./shared";
import { hrApi } from "../../../lib/api";

export default function EmployeeQuickViewModal({ employeeId, onClose }: { employeeId: string | null; onClose: () => void }) {
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!employeeId) { setEmployee(null); return; }
    let cancelled = false;
    setLoading(true);
    hrApi.employee(employeeId)
      .then((r: any) => { if (!cancelled) setEmployee(r?.data?.item ?? r?.data ?? null); })
      .catch(() => { if (!cancelled) setEmployee(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [employeeId]);

  const e = employee;
  const meta = e ? employeeStatusMeta(e.status) : null;
  const rows: Array<[string, any]> = e ? [
    ["Employee ID", e.employeeCode],
    ["Full Name", e.fullName],
    ["Official Email", e.officialEmail],
    ["Personal Email", e.personalEmail],
    ["Mobile", e.mobile],
    ["Department", e.department?.name],
    ["Designation", e.designation?.name],
    ["Employment Type", e.employmentType?.name],
    ["Status", meta?.label],
    ["Joining Date", formatDate(e.joiningDate)],
    ["Leaving Date", e.leavingDate ? formatDate(e.leavingDate) : null],
    ["Work Location", e.workLocation],
    ["Qualification", e.qualification],
    ["Institution", e.education?.[0]?.institution],
    ["Specialization", e.specialization || e.education?.[0]?.field],
    ["Graduation Year", e.graduationYear ?? e.education?.[0]?.endYear],
    ["Total Experience", e.totalExperience != null ? `${e.totalExperience} years` : null],
    ["Relevant Experience", e.relevantExperience != null ? `${e.relevantExperience} years` : null],
    ["Previous Organization", e.previousOrganization || e.employmentHistory?.[0]?.organization],
    ["CV", e.cvFileId ? "Attached" : "Missing"],
  ] : [];

  return (
    <Modal
      open={Boolean(employeeId)}
      onClose={onClose}
      title={e ? "Employee Details" : "Employee Details"}
      subtitle={e ? `${e.employeeCode} · ${e.department?.name || "—"}` : undefined}
      size="lg"
      footer={e ? <Button variant="outline" icon={ExternalLink} onClick={() => window.open(`/hr/employees/${e.id}`, "_self")}>Open full profile</Button> : undefined}
    >
      {loading && <div className="loading-block"><div className="spinner" /> Loading employee details…</div>}
      {!loading && e && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <div className="avatar avatar--lg">{initials(e.fullName || "")}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: "var(--ink)" }}>{e.fullName}</div>
              <div style={{ color: "var(--muted)", fontSize: 13 }}>{e.designation?.name || "—"} · {e.department?.name || "—"}</div>
            </div>
            {meta && <Badge variant={meta.variant} dot>{meta.label}</Badge>}
          </div>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {rows.filter(([, v]) => v !== undefined && v !== null && v !== "").map(([label, value]) => (
                <tr key={label}>
                  <th style={{ width: "38%", textAlign: "left", padding: "10px 20px", background: "var(--surface-muted, #f8faf7)", color: "var(--muted)", fontWeight: 600, fontSize: 13, borderBottom: "1px solid var(--border)" }}>{label}</th>
                  <td style={{ padding: "10px 20px", color: "var(--ink)", fontSize: 14, borderBottom: "1px solid var(--border)" }}>{String(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && !e && employeeId && <div className="empty-state">Employee details could not be loaded.</div>}
    </Modal>
  );
}
