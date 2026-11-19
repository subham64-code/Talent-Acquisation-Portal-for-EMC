const LABELS: Record<string, string> = {
  APPLIED: "Applied",
  UNDER_REVIEW: "Under Review",
  AI_RECOMMENDED: "AI Recommended",
  SHORTLISTED: "Shortlisted",
  INTERVIEW_SCHEDULED: "Interview Scheduled",
  INTERVIEW_COMPLETED: "Interview Completed",
  SELECTED: "Selected",
  REJECTED: "Rejected",
  ON_HOLD: "On Hold",
  OFFER_SENT: "Offer Sent",
  OFFER_ACCEPTED: "Offer Accepted",
  DOCUMENTS_PENDING: "Documents Pending",
  DOCUMENTS_UNDER_REVIEW: "Documents Under Review",
  HIRED: "Hired",
  WITHDRAWN: "Withdrawn",
  DRAFT: "Draft",
  PUBLISHED: "Published",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
  ACTIVE: "Active",
  INVITED: "Invited",
  INACTIVE: "Inactive",
  EXISTING: "Existing",
  FORMER: "Former",
  SENT: "Sent",
  VIEWED: "Viewed",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default function StatusPill({ status }: { status?: string | null }) {
  const raw = String(status ?? "").trim();
  const label = LABELS[raw.toUpperCase()] ?? raw.replace(/_/g, " ");
  const tone = raw.toLowerCase().replace(/_/g, "-");
  return <span className={`status-pill status-pill--${tone}`}>{label}</span>;
}
