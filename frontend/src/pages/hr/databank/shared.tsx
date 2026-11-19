import type { ReactNode } from "react";

export const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

export const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : `${d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} · ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
};

export const relativeDay = (value?: string | null) => {
  if (!value) return "—";
  const target = new Date(value);
  const today = new Date();
  const a = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diff = Math.round((a - b) / 86_400_000);
  if (Number.isNaN(diff)) return "—";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return diff > 1 ? `In ${diff} days` : `${Math.abs(diff)} days ago`;
};

export const initials = (name: string) =>
  (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

export const fileSize = (bytes?: number | null) => {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const employeeStatusMeta = (status: string) =>
  status === "FORMER"
    ? { label: "Former Employee", shortLabel: "Former", variant: "grey" as const }
    : { label: "Current Employee", shortLabel: "Current", variant: "green" as const };

export const invitationStatusMeta = (status: string) => {
  const map: Record<string, { label: string; variant: "green" | "orange" | "blue" | "red" | "grey" | "purple" }> = {
    SENT: { label: "Pending", variant: "orange" },
    OPENED: { label: "Opened", variant: "blue" },
    DRAFT: { label: "In Progress", variant: "blue" },
    SUBMITTED: { label: "Submitted", variant: "green" },
    VALIDATED: { label: "Validated", variant: "green" },
    REJECTED: { label: "Rejected", variant: "red" },
    EXPIRED: { label: "Expired", variant: "red" },
  };
  return map[status] ?? { label: status, variant: "grey" };
};

export const submissionStatusMeta = (status: string) => {
  const map: Record<string, { label: string; variant: "green" | "orange" | "red" }> = {
    PENDING: { label: "Awaiting validation", variant: "orange" },
    VALIDATED: { label: "Validated", variant: "green" },
    REJECTED: { label: "Rejected", variant: "red" },
  };
  return map[status] ?? { label: status, variant: "orange" };
};

export const completionTone = (value: number) => {
  if (value >= 100) return "green";
  if (value > 0) return "orange";
  return "grey";
};

export function EmptyStateBlock({ icon: Icon, title, description, action }: {
  icon: any;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">
        <Icon size={24} aria-hidden="true" />
      </span>
      <p className="empty-state__title">{title}</p>
      <p className="empty-state__text">{description}</p>
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
