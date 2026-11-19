export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  HR_ADMIN: "HR_ADMIN",
  HR_RECRUITER: "HR_RECRUITER",
  DEPARTMENT_MANAGER: "DEPARTMENT_MANAGER",
  INTERVIEWER: "INTERVIEWER",
  IT_ADMIN: "IT_ADMIN",
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES];

export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",
  EMPLOYEES_VIEW: "employees.view",
  EMPLOYEES_MANAGE: "employees.manage",
  CANDIDATES_VIEW: "candidates.view",
  CANDIDATES_MANAGE: "candidates.manage",
  OPENINGS_VIEW: "openings.view",
  OPENINGS_MANAGE: "openings.manage",
  APPLICATIONS_VIEW: "applications.view",
  APPLICATIONS_MANAGE: "applications.manage",
  AI_VIEW: "ai.view",
  AI_RUN: "ai.run",
  INTERVIEWS_VIEW: "interviews.view",
  INTERVIEWS_MANAGE: "interviews.manage",
  OFFERS_VIEW: "offers.view",
  OFFERS_MANAGE: "offers.manage",
  DOCUMENTS_VIEW: "documents.view",
  DOCUMENTS_MANAGE: "documents.manage",
  DATABANK_VIEW: "databank.view",
  DATABANK_MANAGE: "databank.manage",
  REPORTS_VIEW: "reports.view",
  NOTIFICATIONS_VIEW: "notifications.view",
  USERS_MANAGE: "users.manage",
  USERS_RESET: "users.reset",
  SETTINGS_MANAGE: "settings.manage",
  DEPARTMENTS_MANAGE: "departments.manage",
  AUDIT_VIEW: "audit.view",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Plain-English catalogue for the access screen: what the permission lets an
 * HR user do, in words a non-technical person understands, plus the module it
 * belongs to. Keep descriptions short and action-focused.
 */
export interface PermissionMeta {
  label: string;
  description: string;
  module: string;
}
export const PERMISSION_META: Record<PermissionKey, PermissionMeta> = {
  [PERMISSIONS.DASHBOARD_VIEW]: { label: "Open the HR dashboard", description: "See the main HR overview — hiring numbers, pending work and team activity at a glance.", module: "Dashboard" },
  [PERMISSIONS.EMPLOYEES_VIEW]: { label: "View employee records", description: "Open the employee databank and look up any employee's details.", module: "Employee Databank" },
  [PERMISSIONS.EMPLOYEES_MANAGE]: { label: "Add & edit employees", description: "Create new employee records, edit their details, upload or remove CVs and send profile invitations.", module: "Employee Databank" },
  [PERMISSIONS.CANDIDATES_VIEW]: { label: "View candidates", description: "Open candidate applications and read CVs and other submitted details.", module: "Candidates" },
  [PERMISSIONS.CANDIDATES_MANAGE]: { label: "Shortlist & move candidates", description: "Shortlist, hold, reject or move candidates through the hiring stages.", module: "Candidates" },
  [PERMISSIONS.OPENINGS_VIEW]: { label: "View job openings", description: "See job openings for the company, including drafts and published roles.", module: "Job Openings" },
  [PERMISSIONS.OPENINGS_MANAGE]: { label: "Create & publish openings", description: "Create, edit, publish, close or archive job openings and their descriptions.", module: "Job Openings" },
  [PERMISSIONS.APPLICATIONS_VIEW]: { label: "View applications", description: "Open applications received for any opening and see where each one stands.", module: "Applications" },
  [PERMISSIONS.APPLICATIONS_MANAGE]: { label: "Move applications forward", description: "Advance or return applications between stages (applied, screening, interview, offer) and add remarks.", module: "Applications" },
  [PERMISSIONS.AI_VIEW]: { label: "View AI screening results", description: "Read AI match scores, rankings and the reasons behind them.", module: "AI Screening" },
  [PERMISSIONS.AI_RUN]: { label: "Run AI screening", description: "Start or rerun AI screening — scores and rankings are generated for an opening.", module: "AI Screening" },
  [PERMISSIONS.INTERVIEWS_VIEW]: { label: "View interviews", description: "Open the interview calendar, interview details and recorded feedback.", module: "Interviews" },
  [PERMISSIONS.INTERVIEWS_MANAGE]: { label: "Schedule & record interviews", description: "Schedule, reschedule and cancel interviews, and record feedback and results.", module: "Interviews" },
  [PERMISSIONS.OFFERS_VIEW]: { label: "View offers", description: "Open offer letters and see their status and history.", module: "Offers" },
  [PERMISSIONS.OFFERS_MANAGE]: { label: "Create & send offers", description: "Create, approve, send and track offer and appointment letters.", module: "Offers" },
  [PERMISSIONS.DOCUMENTS_VIEW]: { label: "View documents", description: "Open documents uploaded by employees and candidates.", module: "Documents" },
  [PERMISSIONS.DOCUMENTS_MANAGE]: { label: "Verify & manage documents", description: "Verify, reject or request re-upload of documents.", module: "Documents" },
  [PERMISSIONS.DATABANK_VIEW]: { label: "Open the CV databank", description: "Open the full CV databank — profiles, employment history and uploaded files.", module: "Employee Databank" },
  [PERMISSIONS.DATABANK_MANAGE]: { label: "Edit the CV databank", description: "Edit databank records — add CV versions, update employment history and manage files.", module: "Employee Databank" },
  [PERMISSIONS.REPORTS_VIEW]: { label: "View reports", description: "Open recruitment and HR reports and download them.", module: "Reports" },
  [PERMISSIONS.NOTIFICATIONS_VIEW]: { label: "View notifications", description: "Read the notification feed and the list of emails that were sent.", module: "Notifications" },
  [PERMISSIONS.USERS_MANAGE]: { label: "Manage the HR team", description: "Add HR team members, activate or deactivate accounts and set passwords.", module: "HR Team & Access" },
  [PERMISSIONS.USERS_RESET]: { label: "Reset HR accounts", description: "Revoke sessions and reset HR accounts (IT Administrator / Main Controller only).", module: "HR Team & Access" },
  [PERMISSIONS.SETTINGS_MANAGE]: { label: "Change portal settings", description: "Change portal settings such as AI scoring weights and mail configuration.", module: "Settings" },
  [PERMISSIONS.DEPARTMENTS_MANAGE]: { label: "Manage departments", description: "Create and edit departments and assign employees to them.", module: "Settings" },
  [PERMISSIONS.AUDIT_VIEW]: { label: "View the audit log", description: "See who did what across the portal, and when (Main Controller / IT Administrator only).", module: "Audit Log" },
};

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS);

export const ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  [ROLES.SUPER_ADMIN]: ALL_PERMISSIONS,
  [ROLES.IT_ADMIN]: ALL_PERMISSIONS,
  [ROLES.HR_ADMIN]: ALL_PERMISSIONS.filter(
    (p) => p !== PERMISSIONS.USERS_RESET && p !== PERMISSIONS.AUDIT_VIEW,
  ),
  [ROLES.HR_RECRUITER]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CANDIDATES_VIEW,
    PERMISSIONS.CANDIDATES_MANAGE,
    PERMISSIONS.OPENINGS_VIEW,
    PERMISSIONS.APPLICATIONS_VIEW,
    PERMISSIONS.APPLICATIONS_MANAGE,
    PERMISSIONS.AI_VIEW,
    PERMISSIONS.AI_RUN,
    PERMISSIONS.INTERVIEWS_VIEW,
    PERMISSIONS.INTERVIEWS_MANAGE,
    PERMISSIONS.DATABANK_VIEW,
    PERMISSIONS.DOCUMENTS_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.NOTIFICATIONS_VIEW,
  ],
  [ROLES.DEPARTMENT_MANAGER]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CANDIDATES_VIEW,
    PERMISSIONS.OPENINGS_VIEW,
    PERMISSIONS.APPLICATIONS_VIEW,
    PERMISSIONS.AI_VIEW,
    PERMISSIONS.INTERVIEWS_VIEW,
    PERMISSIONS.INTERVIEWS_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.NOTIFICATIONS_VIEW,
    PERMISSIONS.DATABANK_VIEW,
  ],
  [ROLES.INTERVIEWER]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.INTERVIEWS_VIEW,
    PERMISSIONS.INTERVIEWS_MANAGE,
    PERMISSIONS.NOTIFICATIONS_VIEW,
  ],
};

export const ROLE_NAMES: Record<RoleKey, string> = {
  SUPER_ADMIN: "HR Department (Main Controller)",
  HR_ADMIN: "HR Admin",
  HR_RECRUITER: "Sub HR",
  DEPARTMENT_MANAGER: "Department Manager",
  INTERVIEWER: "Interviewer",
  IT_ADMIN: "IT Administrator",
};

/** Roles that control the whole HR team (assign roles, create/deactivate HR users). */
export const HR_CONTROLLER_ROLES: RoleKey[] = [ROLES.SUPER_ADMIN];
/** System administrators who can reset/deactivate any account. */
export const SYSTEM_ADMIN_ROLES: RoleKey[] = [ROLES.IT_ADMIN, ROLES.SUPER_ADMIN];

export const EMPLOYEE_STATUS = {
  EXISTING: "EXISTING",
  FORMER: "FORMER",
} as const;

export const JOB_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  CLOSED: "CLOSED",
} as const;

export const APPLICATION_STATUS = {
  APPLIED: "APPLIED",
  UNDER_REVIEW: "UNDER_REVIEW",
  AI_RECOMMENDED: "AI_RECOMMENDED",
  SHORTLISTED: "SHORTLISTED",
  INTERVIEW_SCHEDULED: "INTERVIEW_SCHEDULED",
  INTERVIEW_COMPLETED: "INTERVIEW_COMPLETED",
  SELECTED: "SELECTED",
  REJECTED: "REJECTED",
  ON_HOLD: "ON_HOLD",
  OFFER_SENT: "OFFER_SENT",
  OFFER_ACCEPTED: "OFFER_ACCEPTED",
  DOCUMENTS_PENDING: "DOCUMENTS_PENDING",
  DOCUMENTS_UNDER_REVIEW: "DOCUMENTS_UNDER_REVIEW",
  HIRED: "HIRED",
  WITHDRAWN: "WITHDRAWN",
} as const;

export type ApplicationStatus = (typeof APPLICATION_STATUS)[keyof typeof APPLICATION_STATUS];

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
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
};

export const APPLICATION_TRANSITIONS: Record<string, ApplicationStatus[]> = {
  APPLIED: ["UNDER_REVIEW", "AI_RECOMMENDED", "SHORTLISTED", "REJECTED", "ON_HOLD", "WITHDRAWN"],
  UNDER_REVIEW: ["AI_RECOMMENDED", "SHORTLISTED", "REJECTED", "ON_HOLD", "WITHDRAWN"],
  AI_RECOMMENDED: ["UNDER_REVIEW", "SHORTLISTED", "REJECTED", "ON_HOLD", "WITHDRAWN"],
  SHORTLISTED: ["INTERVIEW_SCHEDULED", "SELECTED", "REJECTED", "ON_HOLD", "WITHDRAWN"],
  INTERVIEW_SCHEDULED: ["INTERVIEW_COMPLETED", "SHORTLISTED", "SELECTED", "UNDER_REVIEW", "REJECTED", "ON_HOLD", "WITHDRAWN"],
  INTERVIEW_COMPLETED: ["SELECTED", "REJECTED", "ON_HOLD", "INTERVIEW_SCHEDULED"],
  SELECTED: ["OFFER_SENT", "REJECTED", "ON_HOLD", "WITHDRAWN"],
  ON_HOLD: ["UNDER_REVIEW", "AI_RECOMMENDED", "SHORTLISTED", "SELECTED", "REJECTED", "WITHDRAWN"],
  OFFER_SENT: ["OFFER_ACCEPTED", "REJECTED", "WITHDRAWN"],
  OFFER_ACCEPTED: ["DOCUMENTS_PENDING", "DOCUMENTS_UNDER_REVIEW", "HIRED", "WITHDRAWN"],
  DOCUMENTS_PENDING: ["DOCUMENTS_UNDER_REVIEW", "HIRED", "WITHDRAWN"],
  DOCUMENTS_UNDER_REVIEW: ["DOCUMENTS_PENDING", "HIRED", "WITHDRAWN"],
  REJECTED: ["UNDER_REVIEW"],
  HIRED: [],
  WITHDRAWN: [],
};

export const TERMINAL_STATUSES = ["HIRED", "WITHDRAWN"];

export const DOCUMENT_STATUS = {
  NOT_UPLOADED: "NOT_UPLOADED",
  UPLOADED: "UPLOADED",
  UNDER_REVIEW: "UNDER_REVIEW",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  REUPLOAD_REQUIRED: "REUPLOAD_REQUIRED",
} as const;

export const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  NOT_UPLOADED: "Not Uploaded",
  UPLOADED: "Uploaded",
  UNDER_REVIEW: "Under Review",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  REUPLOAD_REQUIRED: "Re-upload Required",
};

export const OFFER_STATUS = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  VIEWED: "VIEWED",
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED",
  EXPIRED: "EXPIRED",
  WITHDRAWN: "WITHDRAWN",
} as const;

export const INTERVIEW_STATUS = {
  SCHEDULED: "SCHEDULED",
  RESCHEDULED: "RESCHEDULED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export const INTERVIEW_RESULT = {
  PENDING: "PENDING",
  SELECTED: "SELECTED",
  REJECTED: "REJECTED",
  ON_HOLD: "ON_HOLD",
  NEXT_ROUND: "NEXT_ROUND",
} as const;

export const INTERVIEW_MODES = ["ONLINE", "OFFLINE"] as const;

export const FILE_VISIBILITY = {
  PRIVATE: "PRIVATE",
  INTERNAL: "INTERNAL",
} as const;

export const EMAIL_TEMPLATE_KEYS = [
  "employee_update_invitation",
  "employee_update_reminder",
  "employee_update_changes_requested",
  "employee_update_confirmation",
  "candidate_email_otp",
  "application_confirmation",
  "candidate_shortlisted",
  "interview_scheduled",
  "interview_rescheduled",
  "interview_scheduled_interviewer",
  "interview_rescheduled_interviewer",
  "interview_cancelled",
  "candidate_selected",
  "candidate_rejected",
  "offer_letter",
  "offer_accepted",
  "document_upload_request",
  "document_accepted",
  "document_rejected",
  "document_reupload_request",
  "pending_document_reminder",
  "hr_invitation",
  "hr_otp",
  "hr_notification",
] as const;

export const DOCUMENT_CATEGORIES = [
  { name: "Class 10 Certificate", isRequired: true, sortOrder: 1 },
  { name: "Class 12 Certificate", isRequired: true, sortOrder: 2 },
  { name: "Diploma Certificate", isRequired: false, sortOrder: 3 },
  { name: "Graduation Certificate", isRequired: true, sortOrder: 4 },
  { name: "Postgraduation Certificate", isRequired: false, sortOrder: 5 },
  { name: "Previous Employment Certificate", isRequired: false, sortOrder: 6 },
  { name: "Experience Letter", isRequired: true, sortOrder: 7 },
  { name: "Relieving Letter", isRequired: true, sortOrder: 8 },
  { name: "Identity Document", isRequired: true, sortOrder: 9 },
  { name: "Professional Certification", isRequired: false, sortOrder: 10 },
  { name: "Accepted Offer Letter", isRequired: true, sortOrder: 11 },
  { name: "Other Required Document", isRequired: false, sortOrder: 12 },
];

export const DEFAULT_DEPARTMENTS = [
  "Urban Planning",
  "GIS Engineering",
  "IT Department",
  "Telecom Engineering",
  "BDE",
  "Accounts and Finance",
  "Survey",
  "Design",
  "Drainage",
  "Research and Development",
  "Water Supply",
  "Civil Engineering",
  "Mechanical Engineering",
  "Hydraulics Engineering",
  "MIS",
  "Data Analytics",
  "Human Resources",
  "Reception",
  "Security",
  "Other",
];

export const DEFAULT_EMPLOYMENT_TYPES = [
  "Full-Time",
  "Consultant",
  "Contract",
  "Intern",
  "Part-Time",
];
