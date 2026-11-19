import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  BriefcaseBusiness,
  CalendarClock,
  ClipboardList,
  FileText,
  MailQuestion,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useMemo } from "react";
import { hrApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { canAccess, SECTION_PERMISSIONS } from "../../lib/sectionPermissions";
import Button from "../../components/ref/Button";
import EmptyState from "../../components/ref/EmptyState";
import { useApiQuery, queryKeys, useInvalidate } from "../../hooks/useApiQuery";

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function HrWorkspaceDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const invalidate = useInvalidate();
  const can = (permission?: string) => canAccess(user, permission);

  const { data: overview } = useApiQuery<any>(queryKeys.dashboardOverview, () => hrApi.dashboardOverview());
  const { data: departments = [] } = useApiQuery<any[]>(
    queryKeys.dashboardDepartments,
    () => hrApi.dashboardDepartments().then((response: any) => response?.data?.data?.departments ?? response?.data?.departments ?? []),
  );
  const { data: openings = [] } = useApiQuery<any[]>(
    ["dashboard", "openings"],
    () => hrApi.openings({ page: 1, pageSize: 8 }).then((response: any) => response?.data?.items ?? []),
    { enabled: can(SECTION_PERMISSIONS.openings) },
  );
  const { data: applications = [] } = useApiQuery<any[]>(
    ["dashboard", "applications"],
    () => hrApi.applications({ page: 1, pageSize: 50 }).then((response: any) => response?.data?.items ?? []),
    { enabled: can(SECTION_PERMISSIONS.submissions) },
  );
  const { data: auditLogs = [] } = useApiQuery<any[]>(
    ["dashboard", "activity"],
    () => hrApi.auditLogs({ page: 1, pageSize: 6 }).then((response: any) => response?.data?.items ?? response?.data?.logs ?? []),
    { enabled: can(SECTION_PERMISSIONS.audit) },
  );

  const displayName = /^emc[\s-]+hr[\s-]+administrator$/i.test((user?.name || "").trim()) ? "HR Department" : user?.name || "HR Department";

  const stats = overview ?? {};
  const tasks = useMemo(() => {
    const items = [
      { title: "New applications to review", description: `${Number(stats.newApplications ?? 0)} candidate(s) are waiting for first review`, to: "/hr/submissions", count: Number(stats.newApplications ?? 0), tone: "blue", permission: SECTION_PERMISSIONS.submissions },
      { title: "Candidates under screening", description: `${Number(stats.underScreening ?? 0)} application(s) need CV screening and HR actions`, to: "/hr/ai-screening", count: Number(stats.underScreening ?? 0), tone: "orange", permission: SECTION_PERMISSIONS.ai },
      { title: "Admin approvals pending", description: `${Number(stats.pendingApprovals ?? 0)} selected candidate(s) require your authorisation`, to: "/hr/approvals", count: Number(stats.pendingApprovals ?? 0), tone: "red", permission: SECTION_PERMISSIONS.submissions },
      { title: "Offers pending response", description: `${Number(stats.offersAwaitingResponse ?? stats.pendingOffers ?? 0)} offer(s) are waiting for acceptance/rejection`, to: "/hr/offers", count: Number(stats.offersAwaitingResponse ?? stats.pendingOffers ?? 0), tone: "orange", permission: SECTION_PERMISSIONS.offers },
      { title: "Documents to verify", description: `${Number(stats.documentsAwaitingVerification ?? 0)} document(s) uploaded and awaiting HR review`, to: "/hr/onboarding", count: Number(stats.documentsAwaitingVerification ?? 0), tone: "blue", permission: SECTION_PERMISSIONS.onboarding },
      { title: "Joinings in progress", description: `${Number(stats.joiningPending ?? 0)} accepted candidate(s) are still completing onboarding`, to: "/hr/onboarding", count: Number(stats.joiningPending ?? 0), tone: "orange", permission: SECTION_PERMISSIONS.onboarding },
    ];
    return items.filter((item) => canAccess(user, item.permission)).sort((left, right) => right.count - left.count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, user]);

  const metrics = [
    { label: "Total employees", value: Number(stats.totalEmployees ?? 0).toLocaleString(), detail: `${Number(stats.existingEmployees ?? 0)} current · ${Number(stats.formerEmployees ?? 0)} former`, icon: UsersRound, to: "/hr/employees?tab=current", tone: "green", permission: SECTION_PERMISSIONS.employees },
    { label: "Open positions", value: Number(stats.activeJobOpenings ?? 0), detail: `${Number(stats.closedJobOpenings ?? 0)} closed roles`, icon: BriefcaseBusiness, to: "/hr/manage-openings", tone: "orange", permission: SECTION_PERMISSIONS.openings },
    { label: "Total applications", value: Number(stats.totalApplications ?? 0).toLocaleString(), detail: `${Number(stats.shortlistedCandidates ?? 0)} already shortlisted`, icon: ClipboardList, to: "/hr/submissions", tone: "green", permission: SECTION_PERMISSIONS.submissions },
    { label: "Invitations pending", value: Number(stats.pendingInvitations ?? 0), detail: `${Number(stats.pendingSubmissions ?? 0)} submissions awaiting validation`, icon: MailQuestion, to: "/hr/employees?tab=invitations", tone: "orange", permission: SECTION_PERMISSIONS.employees },
    { label: "Upcoming interviews", value: Number(stats.upcomingInterviews ?? 0), detail: `${Number(stats.upcomingInterviews ?? 0)} scheduled/rescheduled`, icon: CalendarClock, to: "/hr/interviews", tone: "green", permission: SECTION_PERMISSIONS.interviews },
    { label: "Selected for offers", value: Number(stats.selectedCandidates ?? 0), detail: `${Number(stats.employeesHandedOver ?? 0)} handed over`, icon: ShieldCheck, to: "/hr/approvals", tone: "orange", permission: SECTION_PERMISSIONS.submissions },
  ].filter((metric) => canAccess(user, metric.permission));

  const recentApplications = useMemo(() => [...applications]
    .sort((left: any, right: any) => new Date(right.appliedAt ?? right.createdAt ?? 0).getTime() - new Date(left.appliedAt ?? left.createdAt ?? 0).getTime())
    .slice(0, 6), [applications]);

  const refreshWorkspace = () => invalidate(["dashboard", "departments", "openings", "applications", "email-logs", "audit-logs", "offers", "documents", "onboarding", "interviews"]);

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h1 className="page-heading__title">{timeGreeting()}, {displayName}</h1>
          <p className="page-heading__subtitle">Every metric, pending action and team status updates live from the cloud database.</p>
        </div>
        <div className="page-heading__actions"><Button variant="outline" icon={RefreshCw} onClick={refreshWorkspace}>Refresh live data</Button>{can(SECTION_PERMISSIONS.reports) && <Link className="btn btn--primary" to="/hr/reports"><Activity size={16} /> Live reports</Link>}</div>
      </div>

      <div className="hr-metric-grid hr-metric-grid--six">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <button type="button" key={metric.label} className={`hr-metric hr-metric--${metric.tone} hr-metric--button`} onClick={() => navigate(metric.to)} aria-label={`Open ${metric.label}`}>
              <span><span className="hr-metric__label">{metric.label}</span><strong className="hr-metric__value">{metric.value}</strong><span className="hr-metric__detail">{metric.detail}</span></span>
              <span className="hr-metric__icon"><Icon size={22} /></span>
            </button>
          );
        })}
      </div>

      <div className="hr-dashboard-grid hr-dashboard-grid--workspace">
        <section className="card">
          <div className="card__header"><div><h2 className="card__title">Today&apos;s operating agenda</h2><p className="card__subtitle">Ranked by everything still waiting for HR.</p></div></div>
          <div className="operational-agenda">
            {tasks.length === 0 && <EmptyState icon={ClipboardList} title="Nothing waiting for you" description="There are no pending items you can act on — granted sections will appear here." />}
            {tasks.map((task, index) => (
              <Link to={task.to} key={task.title} className={`operational-agenda__item operational-agenda__item--${task.tone}`}>
                <span className="operational-agenda__index">{String(index + 1).padStart(2, "0")}</span>
                <span className="operational-agenda__body">
                  <strong>{task.title}</strong>
                  <small>{task.description}</small>
                </span>
                <span className="operational-agenda__count">{task.count}</span>
              </Link>
            ))}
          </div>
        </section>

        {can(SECTION_PERMISSIONS.submissions) && (
          <section className="card">
            <div className="card__header"><div><h2 className="card__title">Recent applications</h2><p className="card__subtitle">Newest candidates HR needs to review first.</p></div><Link className="text-link" to="/hr/submissions">View all</Link></div>
          <div className="compact-list">
            {recentApplications.length === 0 ? <EmptyState icon={ClipboardList} title="No applications yet" description="Candidate applications will appear here as soon as they are received." /> : recentApplications.map((application: any) => (
              <Link className="compact-list__item" key={application.id} to={`/hr/submissions?search=${encodeURIComponent(application.applicationCode)}`}>
                <span className="compact-list__icon"><FileText size={16} /></span>
                <div><strong>{application.candidate?.fullName ?? "Candidate"}</strong><span>{application.jobOpening?.title ?? "Position"} · {application.applicationCode}</span></div>
                <span className="badge badge--blue">{String(application.status || "").replace(/_/g, " ")}</span>
              </Link>
            ))}
          </div>
          </section>
        )}
      </div>

      <div className="hr-dashboard-grid hr-dashboard-grid--workspace">
        {can(SECTION_PERMISSIONS.openings) && (
          <section className="card">
            <div className="card__header"><div><h2 className="card__title">Recent openings</h2><p className="card__subtitle">Live opening register — click any role to manage it.</p></div><Link className="text-link" to="/hr/manage-openings">Manage</Link></div>
          <div className="compact-list">
            {openings.slice(0, 5).map((opening: any) => (
              <Link className="compact-list__item" key={opening.id} to="/hr/manage-openings">
                <span className="compact-list__icon"><BriefcaseBusiness size={16} /></span>
                <div><strong>{opening.title}</strong><span>{opening.department?.name ?? "—"}{opening.location ? ` · ${opening.location}` : ""}</span></div>
                <span className="status-pill">{String(opening.status ?? "").toLowerCase()}</span>
              </Link>
            ))}
            {openings.length === 0 && <EmptyState icon={BriefcaseBusiness} title="No openings yet" description="Create your first published opening to activate the hiring workflow." />}
          </div>
          </section>
        )}

        {can(SECTION_PERMISSIONS.audit) && (
          <section className="card">
            <div className="card__header"><div><h2 className="card__title">Recent system activity</h2><p className="card__subtitle">Actions written to the HR audit trail.</p></div>{can(SECTION_PERMISSIONS.settings) && <Link className="text-link" to="/hr/settings">Settings</Link>}</div>
            <div className="compact-list">
              {auditLogs.slice(0, 5).map((entry: any, index: number) => (
                <div className="compact-list__item" key={`${entry.id}-${index}`}>
                  <span className="compact-list__icon"><Sparkles size={15} /></span>
                  <div><strong>{String(entry.action || "HR activity").replace(/_/g, " ")}</strong><span>{entry.actorEmail ?? entry.actorId ?? "System"} · {entry.createdAt ? new Date(entry.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</span></div>
                </div>
              ))}
              {auditLogs.length === 0 && <EmptyState icon={Activity} title="No activity yet" description="Workflow events will appear here automatically." />}
            </div>
          </section>
        )}
      </div>

      <section className="card pipeline-card">
        <div className="card__header"><div><h2 className="card__title">Department-wise hiring pipeline</h2><p className="card__subtitle">Click a department to open its operational reports.</p></div>{can(SECTION_PERMISSIONS.reports) && <Link className="text-link" to="/hr/reports">Open reports</Link>}</div>
        <div className="table-wrapper">
          <table className="data-table pipeline-table">
            <thead><tr><th>Department</th><th>Employees</th><th>Open roles</th><th>Applications</th><th>Screened</th><th>Interviews</th><th>Hired</th><th>Progress</th></tr></thead>
            <tbody>
              {departments.map((department: any) => {
                const applicationsTotal = Number(department.totalApplicants ?? 0);
                const hired = Number(department.hired ?? 0);
                const percentage = applicationsTotal ? Math.min(100, Math.round((hired / applicationsTotal) * 100)) : 0;
                return (
                  <tr key={department.id}>
                    <td><strong>{department.name}</strong></td>
                    <td>{Number(department.totalEmployees ?? 0)}</td>
                    <td>{Number(department.activeOpenings ?? 0)}</td>
                    <td>{applicationsTotal}</td>
                    <td>{Number(department.screened ?? 0)}</td>
                    <td>{Number(department.interviews ?? 0)}</td>
                    <td>{hired}</td>
                    <td>{can(SECTION_PERMISSIONS.reports)
                      ? <Link className="pipeline-progress" to="/hr/reports" aria-label={`Open ${department.name} report`}><span style={{ width: `${percentage}%` }} /></Link>
                      : <div className="pipeline-progress pipeline-progress--static"><span style={{ width: `${percentage}%` }} /></div>}</td>
                  </tr>
                );
              })}
              {departments.length === 0 && <tr><td colSpan={8}><div className="empty-state">No department pipeline data yet.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
