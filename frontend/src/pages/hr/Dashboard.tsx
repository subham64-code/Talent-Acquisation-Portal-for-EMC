import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  BellRing,
  CalendarClock,
  CheckCircle2,
  FileStack,
  FileWarning,
  Gauge,
  Inbox,
  MailCheck,
  MailQuestion,
  Send,
  ShieldCheck,
  ShieldQuestion,
  UserCheck,
  UserPlus,
  UsersRound,
} from "lucide-react";
import PageHeader from "../../components/ref/PageHeader";
import Badge from "../../components/ref/Badge";
import DataTable, { type Column } from "../../components/DataTable";
import DepartmentPeoplePanel from "./DepartmentPeoplePanel";
import { hrApi } from "../../lib/api";
import { useApiQuery, queryKeys } from "../../hooks/useApiQuery";
import { EmptyStateBlock, formatDate, formatDateTime, relativeDay, initials } from "./databank/shared";

const STAGES = [
  { key: "APPLIED", label: "Applied", description: "Applications received from the Career Portal", count: (a: any[]) => a.filter((x) => x.status === "APPLIED").length },
  { key: "SCREENING", label: "Screening", description: "CV screening in progress", count: (a: any[]) => a.filter((x) => ["UNDER_REVIEW", "AI_RECOMMENDED"].includes(x.status)).length },
  { key: "SHORTLISTED", label: "Shortlisted", description: "Screened and shortlisted by HR", count: (a: any[]) => a.filter((x) => x.status === "SHORTLISTED").length },
  { key: "INTERVIEW", label: "Interview", description: "Interview rounds in progress", count: (a: any[]) => a.filter((x) => ["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"].includes(x.status)).length },
  { key: "FINAL_SELECTION", label: "Final Selection", description: "HR decision on the interviewed candidate", count: (a: any[]) => a.filter((x) => x.status === "INTERVIEW_COMPLETED").length },
  { key: "APPROVAL", label: "Approval", description: "Hiring recommendation awaiting admin approval", count: (a: any[]) => a.filter((x) => x.status === "SELECTED").length },
  { key: "OFFER", label: "Offer", description: "Offer drafted and issued", count: (a: any[]) => a.filter((x) => ["OFFER_SENT", "OFFER_ACCEPTED"].includes(x.status)).length },
  { key: "JOINING", label: "Joining", description: "Joining and onboarding progress", count: (a: any[]) => a.filter((x) => ["DOCUMENTS_PENDING", "DOCUMENTS_UNDER_REVIEW", "HIRED"].includes(x.status)).length },
];

function statusMeta(status: string): { label: string; variant: "green" | "orange" | "blue" | "red" | "grey" | "purple" } {
  const map: Record<string, { label: string; variant: "green" | "orange" | "blue" | "red" | "grey" | "purple" }> = {
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
    DOCUMENTS_UNDER_REVIEW: { label: "Under Review", variant: "blue" },
    HIRED: { label: "Hired", variant: "green" },
    WITHDRAWN: { label: "Withdrawn", variant: "grey" },
  };
  return map[status] ?? { label: status, variant: "grey" };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedDepartment, setSelectedDepartment] = useState<{ id: string; name: string } | null>(null);

  const { data: overview } = useApiQuery<any>(queryKeys.dashboardOverview, () => hrApi.dashboardOverview());
  const stats = overview ?? {};
  const { data: applications = [] } = useApiQuery<any[]>(
    ["applications", "all", "dashboard"],
    () => hrApi.applications({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? []),
  );
  const { data: interviews = [] } = useApiQuery<any[]>(
    ["interviews", "dashboard"],
    () => hrApi.interviews({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? []),
  );
  const { data: offers = [] } = useApiQuery<any[]>(
    ["offers", "dashboard"],
    () => hrApi.offers({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? []),
  );
  const { data: emailLogs = [] } = useApiQuery<any[]>(
    ["email-logs", "dashboard"],
    () => hrApi.emailLogs().then((r: any) => r?.data?.emailLogs ?? []),
  );
  const { data: auditLogs = [] } = useApiQuery<any[]>(
    ["audit-logs", "dashboard"],
    () => hrApi.auditLogs({ page: 1, pageSize: 7 }).then((r: any) => r?.data?.items ?? r?.data?.logs ?? []),
  );

  const counts = useMemo(
    () => ({
      totalApplications: applications.length,
      newApplications: Number(stats.newApplications ?? 0),
      underScreening: Number(stats.underScreening ?? 0),
      shortlisted: Number(stats.shortlistedCandidates ?? 0),
      upcomingInterviews: Number(stats.upcomingInterviews ?? 0),
      selected: Number(stats.selectedCandidates ?? 0),
      pendingApprovals: Number(stats.pendingApprovals ?? 0),
      offersSent: Number(stats.offersSentCount ?? stats.pendingOffers ?? 0),
      approvedAwaitingOffer: Number(stats.pendingApprovals ?? 0),
      offersAwaitingResponse: Number(stats.offersAwaitingResponse ?? 0),
      acceptedAwaitingDocuments: Number(stats.acceptedAwaitingDocuments ?? 0),
      documentsAwaitingVerification: Number(stats.documentsAwaitingVerification ?? 0),
      documentsResubmissionRequired: Number(stats.documentsResubmissionRequired ?? 0),
      joiningPending: Number(stats.joiningPending ?? 0),
      employeesHandedOver: Number(stats.employeesHandedOver ?? 0),
      hrPendingActions: Number(stats.pendingApprovals ?? 0) + Number(stats.documentsAwaitingVerification ?? 0) + Number(stats.joiningPending ?? 0),
    }),
    [applications.length, stats],
  );

  const statCards = [
    { key: "total", label: "Total Applications", value: counts.totalApplications, meta: "Across all open positions", icon: FileStack, variant: "blue", to: "/hr/submissions" },
    { key: "new", label: "New Applications", value: counts.newApplications, meta: "Awaiting screening", icon: UserPlus, variant: "blue", to: "/hr/submissions" },
    { key: "screening", label: "Under Screening", value: counts.underScreening, meta: "CV screening in progress", icon: UsersRound, variant: "orange", to: "/hr/ai-screening" },
    { key: "shortlisted", label: "Shortlisted", value: counts.shortlisted, meta: "Ready for interview", icon: UserCheck, variant: "purple", to: "/hr/shortlisting" },
    { key: "interviews", label: "Upcoming Interviews", value: counts.upcomingInterviews, meta: "Scheduled rounds ahead", icon: CalendarClock, variant: "orange", to: "/hr/interviews" },
    { key: "selected", label: "Selected", value: counts.selected, meta: "Joined the organisation", icon: CheckCircle2, variant: "green", to: "/hr/final-selection" },
    { key: "approvals", label: "Pending Approvals", value: counts.pendingApprovals, meta: "Awaiting admin decision", icon: ShieldCheck, variant: "orange", to: "/hr/approvals" },
    { key: "offers", label: "Offers Sent", value: counts.offersSent, meta: "Issued to candidates", icon: Send, variant: "blue", to: "/hr/offers" },
    { key: "awaiting-offer", label: "Awaiting Offer", value: counts.approvedAwaitingOffer, meta: "Approved, offer not prepared yet", icon: Inbox, variant: "orange", to: "/hr/offers" },
    { key: "awaiting-response", label: "Offers Awaiting Response", value: counts.offersAwaitingResponse, meta: "Sent, candidate has not responded", icon: MailQuestion, variant: "blue", to: "/hr/offers" },
    { key: "awaiting-documents", label: "Accepted, Docs Pending", value: counts.acceptedAwaitingDocuments, meta: "Document submission requested", icon: MailCheck, variant: "orange", to: "/hr/onboarding" },
    { key: "docs-awaiting-verification", label: "Docs Awaiting Verification", value: counts.documentsAwaitingVerification, meta: "Submitted, HR to verify", icon: ShieldQuestion, variant: "blue", to: "/hr/onboarding" },
    { key: "resubmission", label: "Resubmission Required", value: counts.documentsResubmissionRequired, meta: "Replacement document needed", icon: FileWarning, variant: "orange", to: "/hr/onboarding" },
    { key: "joining-pending", label: "Joining Pending", value: counts.joiningPending, meta: "Not marked as joined yet", icon: UsersRound, variant: "orange", to: "/hr/onboarding" },
    { key: "handed-over", label: "Employees Handed Over", value: counts.employeesHandedOver, meta: "Imported into the Employee Databank", icon: CheckCircle2, variant: "green", to: "/hr/onboarding" },
    { key: "hr-pending", label: "HR Pending Actions", value: counts.hrPendingActions, meta: "Approvals, verifications and ready-to-join", icon: BellRing, variant: "purple", to: "/hr/approvals" },
  ];

  const stageCounts = STAGES.map((stage) => ({ ...stage, count: stage.count(applications) }));
  const maxStageCount = Math.max(...stageCounts.map((stage) => stage.count), 1);
  const totalStage = stageCounts.reduce((sum, stage) => sum + stage.count, 0);

  const departmentPipeline = useMemo(() => {
    const map = new Map<string, any>();
    for (const application of applications) {
      const department = application?.jobOpening?.department;
      const id = department?.id ?? "unassigned";
      const existing = map.get(id) ?? {
        id,
        name: department?.name ?? "Unassigned",
        applied: 0,
        screening: 0,
        shortlisted: 0,
        interview: 0,
        finalSelection: 0,
        approval: 0,
        offer: 0,
        joining: 0,
        total: 0,
      };
      existing.applied += application.status === "APPLIED" ? 1 : 0;
      existing.screening += ["UNDER_REVIEW", "AI_RECOMMENDED"].includes(application.status) ? 1 : 0;
      existing.shortlisted += application.status === "SHORTLISTED" ? 1 : 0;
      existing.interview += ["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"].includes(application.status) ? 1 : 0;
      existing.finalSelection += application.status === "INTERVIEW_COMPLETED" ? 1 : 0;
      existing.approval += application.status === "SELECTED" ? 1 : 0;
      existing.offer += ["OFFER_SENT", "OFFER_ACCEPTED"].includes(application.status) ? 1 : 0;
      existing.joining += ["DOCUMENTS_PENDING", "DOCUMENTS_UNDER_REVIEW", "HIRED"].includes(application.status) ? 1 : 0;
      existing.total += 1;
      map.set(id, existing);
    }
    return Array.from(map.values()).sort((left, right) => right.total - left.total || String(left.name).localeCompare(String(right.name)));
  }, [applications]);
  const departmentMax = Math.max(...departmentPipeline.map((row) => row.total), 1);
  const selectDepartment = (department: { id: string; name: string }) => {
    setSelectedDepartment(department);
    window.setTimeout(() => document.getElementById("department-people")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const departmentColumns: Column<any>[] = [
    {
      key: "name",
      header: "Department",
      render: (department) => (
        <button type="button" className={`ta-department-link ${selectedDepartment?.id === department.id ? "active" : ""}`} onClick={() => selectDepartment(department)}>
          <span>{department.name}</span>
          <span aria-hidden="true">→</span>
        </button>
      ),
    },
    { key: "applied", header: "Applied", render: (department) => <span className="ta-dept-count">{department.applied}</span> },
    { key: "screening", header: "Screening", render: (department) => <span className="ta-dept-count">{department.screening}</span> },
    { key: "shortlisted", header: "Shortlisted", render: (department) => <span className="ta-dept-count">{department.shortlisted}</span> },
    { key: "interview", header: "Interview", render: (department) => <span className="ta-dept-count">{department.interview}</span> },
    { key: "finalSelection", header: "Final Selection", render: (department) => <span className="ta-dept-count">{department.finalSelection}</span> },
    { key: "approval", header: "Approval", render: (department) => <span className="ta-dept-count">{department.approval}</span> },
    { key: "offer", header: "Offer", render: (department) => <span className="ta-dept-count">{department.offer}</span> },
    { key: "joining", header: "Joining", render: (department) => <span className="ta-dept-count">{department.joining}</span> },
    { key: "total", header: "Total", render: (department) => <strong className="ta-dept-total">{department.total}</strong> },
    { key: "action", header: "Action", className: "text-right", render: (department) => <button type="button" className="btn btn--outline btn--sm" onClick={() => selectDepartment(department)}>{selectedDepartment?.id === department.id ? "Viewing" : "View people"}</button> },
  ];

  const recentApplications = useMemo(
    () => [...applications].sort((a, b) => new Date(b.appliedAt || b.createdAt || 0).getTime() - new Date(a.appliedAt || a.createdAt || 0).getTime()).slice(0, 6),
    [applications],
  );
  const upcomingInterviews = useMemo(
    () => interviews.filter((interview: any) => ["SCHEDULED", "RESCHEDULED"].includes(interview.status) && new Date(interview.scheduledAt).getTime() >= Date.now()).sort((a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()).slice(0, 5),
    [interviews],
  );
  const accepted = offers.filter((offer: any) => offer.status === "ACCEPTED").length;
  const declined = offers.filter((offer: any) => offer.status === "DECLINED").length;
  const responseTotal = accepted + declined;
  const screened = applications.filter((application: any) => application.status !== "APPLIED").length;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Ecometrix · Talent Acquisition"
        title="Recruitment Dashboard"
        subtitle="Live overview of the recruitment pipeline, the upcoming interviews and the hiring activity of the HR team."
        actions={undefined}
      />

      <div className="stats-grid ta-stats-grid" aria-label="Recruitment statistics">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <button type="button" key={card.key} className={`stat-card stat-card--${card.variant}`} onClick={() => navigate(card.to)} aria-label={`View ${card.label}`}>
              <div className={`stat-card__icon stat-card__icon--${card.variant}`}><Icon size={20} aria-hidden="true" /></div>
              <div className="stat-card__content">
                <div className="stat-card__label">{card.label}</div>
                <div className="stat-card__value">{card.value}</div>
                <div className="stat-card__meta">{card.meta}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="ta-dashboard-grid">
        <div className="card">
          <div className="card__header"><div><div className="card__title">Recruitment pipeline</div><div className="card__subtitle">{totalStage} applications across {STAGES.length} stages</div></div></div>
          <div className="card__body">
            <ol className="ta-pipeline">
              {stageCounts.map((stage) => (
                <li className="ta-pipeline__stage" key={stage.key}>
                  <div className="ta-pipeline__button">
                    <div className="ta-pipeline__stage-head"><span className="ta-pipeline__stage-label">{stage.label}</span><span className="ta-pipeline__stage-count">{stage.count}</span></div>
                    <div className="ta-pipeline__track" aria-hidden="true"><span className="ta-pipeline__bar" style={{ width: `${Math.round((stage.count / maxStageCount) * 100)}%` }} /></div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="card">
          <div className="card__header"><div><div className="card__title">Pipeline chart</div><div className="card__subtitle">Visual stage distribution</div></div></div>
          <div className="card__body">
            <div style={{display:'flex',alignItems:'flex-end',gap:10,height:220,padding:'8px 4px'}}>
              {stageCounts.map(s=>{const h=Math.max(6,Math.round((s.count/maxStageCount)*170)); return <div key={s.key} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6}}><div style={{fontSize:11,fontWeight:700,color:'var(--ink)'}}>{s.count}</div><div title={`${s.label}: ${s.count}`} style={{width:'100%',maxWidth:34,height:h,background:'linear-gradient(180deg,#84bd26,#659616)',borderRadius:'8px 8px 2px 2px'}} /><div style={{fontSize:10,color:'var(--muted)',textAlign:'center',lineHeight:1.2}}>{s.label}</div></div>;})}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <div><div className="card__title">Department-wise pipeline</div><div className="card__subtitle">{departmentPipeline.length} departments in the pipeline · largest pipeline has {departmentMax} application{departmentMax === 1 ? "" : "s"}. Click a department to view every candidate in it.</div></div>
        </div>
        <div style={{maxHeight:320,overflowY:"auto"}}><DataTable
          columns={departmentColumns}
          rows={departmentPipeline}
          rowKey={(department) => department.id}
          loading={false}
          empty={<EmptyStateBlock icon={FileStack} title="No department pipeline yet" description="Applications will appear here once candidates apply to department openings." />}
          footer={<><span><strong>{applications.length}</strong> applications</span></>}
          onRowClick={selectDepartment}
        /></div>
      </div>

      <DepartmentPeoplePanel department={selectedDepartment} onClear={() => setSelectedDepartment(null)} />

      <div className="ta-dashboard-grid">
        <section className="card">
          <div className="card__header"><div><div className="card__title">Recent applications</div><div className="card__subtitle">Latest applications received from the Career Portal</div></div><Link className="btn btn--ghost btn--sm" to="/hr/submissions">View all</Link></div>
          <div className="card__body">
            {recentApplications.length === 0 ? (
              <EmptyStateBlock icon={FileStack} title="No applications yet" description="Applications submitted through the Career Portal appear here." />
            ) : (
              <ul className="ta-list">
                {recentApplications.map((application: any) => (
                  <li className="ta-list__item" key={application.id}>
                    <div className="avatar avatar--sm">{initials(application.candidate?.fullName || "?")}</div>
                    <div className="ta-list__body">
                      <div className="ta-list__title">{application.candidate?.fullName || "Candidate"}</div>
                      <div className="ta-list__meta">{application.jobOpening?.title || "Position"} · {formatDate(application.appliedAt || application.createdAt)}</div>
                    </div>
                    <Badge variant={statusMeta(application.status).variant} dot>{statusMeta(application.status).label}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card__header"><div><div className="card__title">Upcoming interviews</div><div className="card__subtitle">Scheduled rounds in the coming days</div></div><CalendarClock size={18} aria-hidden="true" /></div>
          <div className="card__body">
            {upcomingInterviews.length === 0 ? (
              <EmptyStateBlock icon={CalendarClock} title="No interviews scheduled" description="Schedule an interview from the interview management page." />
            ) : (
              <ul className="ta-list">
                {upcomingInterviews.map((interview: any) => (
                  <li className="ta-list__item" key={interview.id}>
                    <div className="ta-list__body">
                      <div className="ta-list__title">{interview.application?.candidate?.fullName || "Candidate"} · {interview.round} round</div>
                      <div className="ta-list__meta">{formatDateTime(interview.scheduledAt)} · {interview.interviewerName || "Interviewer"}</div>
                    </div>
                    <Badge variant="blue">{relativeDay(interview.scheduledAt)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <div className="ta-dashboard-grid">
        <section className="card">
          <div className="card__header"><div><div className="card__title">Recruitment stage distribution</div><div className="card__subtitle">{totalStage} applications across the recruitment stages</div></div><Activity size={18} aria-hidden="true" /></div>
          <div className="card__body">
            <ul className="ta-bar-list">
              {stageCounts.map((stage) => (
                <li className="ta-bar-list__item" key={stage.key}>
                  <div className="ta-bar-list__head"><span className="ta-bar-list__label">{stage.label}</span><span className="ta-bar-list__value">{stage.count}<span className="ta-bar-list__share">{totalStage ? `${Math.round((stage.count / totalStage) * 100)}%` : "0%"}</span></span></div>
                  <div className="ta-bar-list__track" aria-hidden="true"><span className="ta-bar-list__bar" style={{ width: `${Math.round((stage.count / maxStageCount) * 100)}%` }} /></div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="card">
          <div className="card__header"><div><div className="card__title">Recent HR activity</div><div className="card__subtitle">Workflow events recorded by the backend</div></div><Activity size={18} aria-hidden="true" /></div>
          <div className="card__body">
            {auditLogs.length === 0 ? (
              <EmptyStateBlock icon={Activity} title="No activity recorded" description="Workflow events will appear here as the recruitment progresses." />
            ) : (
              <ul className="ta-activity">
                {auditLogs.map((log: any) => (
                  <li className="ta-activity__item" key={log.id}>
                    <span className="ta-activity__dot ta-activity__dot--interview" aria-hidden="true" />
                    <div className="ta-activity__body">
                      <div className="ta-activity__message">{log.action?.replace(/_/g, " ") || "HR activity"}</div>
                      <div className="ta-activity__meta">{formatDateTime(log.createdAt)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <div className="ta-dashboard-grid">
        <section className="card">
          <div className="card__header"><div><div className="card__title">Recent email activity</div><div className="card__subtitle">Offer letters, interview invitations and onboarding emails recorded by the service.</div></div><MailQuestion size={18} aria-hidden="true" /></div>
          <div className="card__body">
            {emailLogs.length === 0 ? (
              <EmptyStateBlock icon={MailQuestion} title="No emails recorded yet" description="Outbound emails appear here once the configured provider sends or simulates them." />
            ) : (
              <ul className="ta-activity">
                {emailLogs.map((email: any) => (
                  <li className="ta-activity__item" key={email.id}>
                    <span className="ta-activity__dot ta-activity__dot--offer" aria-hidden="true" />
                    <div className="ta-activity__body">
                      <div className="ta-activity__message">{email.templateKey ? email.templateKey.replace(/_/g, " ") : email.subject} to {email.toEmail} <Badge variant={email.status === "SENT" ? "green" : "orange"}>{email.status}</Badge></div>
                      <div className="ta-activity__meta">{formatDateTime(email.createdAt)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card__header"><div><div className="card__title">Candidate responses</div><div className="card__subtitle">Recorded through the candidate self-service links</div></div><MailCheck size={18} aria-hidden="true" /></div>
          <div className="card__body">
            <div className="ta-summary-grid">
              <div className="ta-summary__item"><div className="ta-summary__label">Offers accepted</div><div className="ta-summary__value">{accepted}</div></div>
              <div className="ta-summary__item"><div className="ta-summary__label">Offers declined</div><div className="ta-summary__value">{declined}</div></div>
              <div className="ta-summary__item"><div className="ta-summary__label">Offers sent</div><div className="ta-summary__value">{counts.offersSent}</div></div>
              <div className="ta-summary__item"><div className="ta-summary__label">Acceptance rate</div><div className="ta-summary__value">{responseTotal ? Math.round((accepted / responseTotal) * 100) : 0}%</div></div>
            </div>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card__header"><div><div className="card__title">Hiring summary</div><div className="card__subtitle">Derived from the live recruitment records in the cloud database</div></div><Gauge size={18} aria-hidden="true" /></div>
        <div className="card__body">
          <div className="ta-summary-grid">
            <div className="ta-summary__item"><div className="ta-summary__label">Applications received</div><div className="ta-summary__value">{counts.totalApplications}</div></div>
            <div className="ta-summary__item"><div className="ta-summary__label">Screening completed</div><div className="ta-summary__value">{screened}</div></div>
            <div className="ta-summary__item"><div className="ta-summary__label">Shortlisted</div><div className="ta-summary__value">{counts.shortlisted}</div></div>
            <div className="ta-summary__item"><div className="ta-summary__label">Offers sent</div><div className="ta-summary__value">{counts.offersSent}</div></div>
            <div className="ta-summary__item"><div className="ta-summary__label">Selected candidates</div><div className="ta-summary__value">{counts.selected}</div></div>
            <div className="ta-summary__item"><div className="ta-summary__label">Joining pending</div><div className="ta-summary__value">{counts.joiningPending}</div></div>
            <div className="ta-summary__item"><div className="ta-summary__label">Employees handed over</div><div className="ta-summary__value">{counts.employeesHandedOver}</div></div>
            <div className="ta-summary__item"><div className="ta-summary__label">HR pending actions</div><div className="ta-summary__value">{counts.hrPendingActions}</div></div>
          </div>
        </div>
      </section>
    </div>
  );
}
