import Badge, { type BadgeVariant } from "./Badge";

const META: Record<string, { label: string; variant: BadgeVariant }> = {
  APPLIED: { label: "Applied", variant: "grey" },
  UNDER_REVIEW: { label: "Under Review", variant: "orange" },
  AI_RECOMMENDED: { label: "AI Recommended", variant: "blue" },
  SHORTLISTED: { label: "Shortlisted", variant: "purple" },
  INTERVIEW_SCHEDULED: { label: "Interview Scheduled", variant: "blue" },
  INTERVIEW_COMPLETED: { label: "Interview Completed", variant: "orange" },
  SELECTED: { label: "Selected", variant: "green" },
  REJECTED: { label: "Rejected", variant: "red" },
  ON_HOLD: { label: "On Hold", variant: "orange" },
  OFFER_SENT: { label: "Offer Sent", variant: "blue" },
  OFFER_ACCEPTED: { label: "Offer Accepted", variant: "green" },
  DOCUMENTS_PENDING: { label: "Documents Pending", variant: "orange" },
  DOCUMENTS_UNDER_REVIEW: { label: "Documents Under Review", variant: "blue" },
  HIRED: { label: "Hired", variant: "green" },
  WITHDRAWN: { label: "Withdrawn", variant: "grey" },
};

export default function CandidateStatusBadge({ status }: { status: string }) {
  const meta = META[status] ?? { label: String(status).replace(/_/g, " "), variant: "grey" as BadgeVariant };
  return <Badge variant={meta.variant} dot>{meta.label}</Badge>;
}
