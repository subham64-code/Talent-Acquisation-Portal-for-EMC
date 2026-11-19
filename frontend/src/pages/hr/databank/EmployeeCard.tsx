import { CalendarDays, Eye, FileText, Mail, Pencil, Trash2 } from "lucide-react";
import Badge from "../../../components/ref/Badge";
import { formatDate, initials, employeeStatusMeta } from "./shared";

export default function EmployeeCard({ employee, onView, onEdit, onDelete }: {
  employee: any;
  onView?: (employee: any) => void;
  onEdit?: (employee: any) => void;
  onDelete?: (employee: any) => void;
}) {
  const meta = employeeStatusMeta(employee.status);
  return (
    <article className="employee-card">
      <div className="employee-card__top">
        <div className="avatar avatar--lg">{initials(employee.fullName || "")}</div>
        <div className="employee-card__identity">
          <h3 className="employee-card__name">{employee.fullName}</h3>
          <p className="employee-card__role">{employee.designation?.name || "—"}</p>
          <p className="employee-card__dept">{employee.department?.name || "—"}</p>
        </div>
        <Badge variant={meta.variant} dot>{meta.shortLabel}</Badge>
      </div>

      <div className="employee-card__meta">
        <span className="employee-card__meta-item"><Mail size={14} aria-hidden="true" />{employee.officialEmail}</span>
        <span className="employee-card__meta-item"><CalendarDays size={14} aria-hidden="true" />Joined {formatDate(employee.joiningDate)}</span>
        <span className="employee-card__meta-item">
          <FileText size={14} aria-hidden="true" />
          {employee.cvFileId ? "CV attached" : "No CV on file"}
          <Badge variant={employee.cvFileId ? "green" : "grey"}>{employee.cvFileId ? "Ready" : "Missing"}</Badge>
        </span>
      </div>

      <div className="employee-card__footer">
        <span className="cell-muted">{employee.employeeCode}</span>
        <div className="cell-actions">
          <button type="button" className="btn btn--ghost btn--icon" onClick={() => onView?.(employee)} aria-label={`View ${employee.fullName}`} title="View profile"><Eye size={16} /></button>
          <button type="button" className="btn btn--ghost btn--icon" onClick={() => onEdit?.(employee)} aria-label={`Edit ${employee.fullName}`} title="Edit employee"><Pencil size={16} /></button>
          <button type="button" className="btn btn--danger-ghost btn--icon" onClick={() => onDelete?.(employee)} aria-label={`Delete ${employee.fullName}`} title="Delete employee"><Trash2 size={16} /></button>
        </div>
      </div>
    </article>
  );
}
