import { Building2, FileText, Mail, UserCheck, UserMinus, UsersRound } from "lucide-react";

export default function EmployeeStats({ stats, active, onSelect, onView }: {
  stats: { totalEmployees: number; existingEmployees: number; formerEmployees: number; pendingInvitations: number; pendingSubmissions: number; departments: number; onHold?: number };
  active?: string;
  onSelect: (tab: string) => void;
  onView?: (tab: string) => void;
}) {
  const cards = [
    { label: "Total Employees", value: stats.totalEmployees, meta: "Current + former records", icon: UsersRound, tab: "all" },
    { label: "Current Employees", value: stats.existingEmployees, meta: "Active databank records", icon: UserCheck, tab: "current" },
    { label: "Former Employees", value: stats.formerEmployees, meta: "Separate historical records", icon: UserMinus, tab: "former" },
    { label: "On Hold", value: stats.onHold ?? 0, meta: "Candidates on hold", icon: Mail, tab: "hold" },
    { label: "Master Departments", value: stats.departments, meta: "Active department records", icon: Building2, tab: "departments" },
    { label: "Pending Invitations", value: stats.pendingInvitations, meta: "Awaiting employee action", icon: Mail, tab: "invitations" },
    { label: "Submissions", value: stats.pendingSubmissions, meta: "Awaiting HR validation", icon: FileText, tab: "submissions" },
  ] as const;

  return (
    <div className="stats-grid" aria-label="Employee statistics">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = active === card.tab;
        return (
            <div
              key={card.label}
              className={`stat-card ${isActive ? "stat-card--active" : "stat-card--muted"}`}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(card.tab)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(card.tab); } }}
              aria-pressed={isActive}
              aria-label={`Select ${card.label}`}
            >
              <div className={`stat-card__icon ${isActive ? "stat-card__icon--active" : "stat-card__icon--muted"}`}>
                <Icon size={20} aria-hidden="true" />
              </div>
              <div className="stat-card__content" style={{ flex: 1 }}>
                <div className="stat-card__label">{card.label}</div>
                <div className="stat-card__value">{card.value}</div>
                <div className="stat-card__meta">{card.meta}</div>
              </div>

            </div>
        );
      })}
    </div>
  );
}
