import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";import {
  BadgeCheck,
  BarChart3,
  BellRing,
  Briefcase,
  Building2,
  CalendarClock,
  ChevronDown,
  ClipboardCheck,
  Database,
  FileBadge,
  FileCheck2,
  FileText,
  FolderOpen,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import Logo from "./Logo";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { SECTION_PERMISSIONS, canAccess, isController } from "../lib/sectionPermissions";

type NavKey =
  | "dashboard"
  | "openings"
  | "submissions"
  | "ai"
  | "interviews"
  | "offers"
  | "onboarding"
  | "employees"
  | "databank"
  | "departments"
  | "reports"
  | "notifications"
  | "users"
  | "settings"
  | "access-control";

interface NavItem {
  key: NavKey;
  label: string;
  to: string;
  icon: any;
  controllerOnly?: boolean;
}

interface NavGroup {
  key: string;
  label: string;
  icon: any;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    key: "talent",
    label: "Talent Acquisition",
    icon: Briefcase,
    items: [
      { key: "dashboard", label: "Recruitment Dashboard", to: "/hr/dashboard", icon: LayoutDashboard },
      { key: "openings", label: "Manage Openings", to: "/hr/openings", icon: FileText },
      { key: "submissions", label: "Candidate Submissions", to: "/hr/submissions", icon: FileCheck2 },
      { key: "ai", label: "AI Screening", to: "/hr/ai-screening", icon: Sparkles },
      { key: "interviews", label: "Interviews", to: "/hr/interviews", icon: CalendarClock },
      { key: "offers", label: "Offer Management", to: "/hr/offers", icon: FileBadge },
      { key: "onboarding", label: "Joining & Onboarding", to: "/hr/onboarding", icon: ClipboardCheck },
      { key: "reports", label: "Reports & Analytics", to: "/hr/reports", icon: BarChart3 },
    ],
  },
  {
    key: "databank",
    label: "Employee Databank",
    icon: Database,
    items: [
      { key: "employees", label: "Employee Management", to: "/hr/employees", icon: Users },
      { key: "databank", label: "CV Databank", to: "/hr/databank", icon: FolderOpen },
      { key: "departments", label: "Departments", to: "/hr/departments", icon: Building2 },
    ],
  },
  {
    key: "admin",
    label: "Administration",
    icon: ShieldCheck,
    items: [
      { key: "notifications", label: "Notifications", to: "/hr/notifications", icon: BellRing },
      { key: "users", label: "HR User Management", to: "/hr/users", icon: ShieldCheck },
      { key: "access-control", label: "Access Control", to: "/hr/access-control", icon: KeyRound, controllerOnly: true },
      { key: "settings", label: "Settings", to: "/hr/settings", icon: Settings },
    ],
  },
];

export default function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    talent: true,
    databank: true,
    admin: true,
  });

  useEffect(() => {
    onNavigate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const visibleGroups = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((i) =>
      i.controllerOnly ? isController(user) : canAccess(user, SECTION_PERMISSIONS[i.key]),
    ),
  })).filter((group) => group.items.length > 0);

  const handleLogout = async () => {
    await logout();
    navigate("/auth/hr/login");
  };

  const initials = (user?.name || "HR")
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onNavigate}
          className="fixed inset-0 z-[55] bg-slate-900/40 backdrop-blur-[1px] md:hidden border-0 cursor-pointer"
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full z-[60] w-[268px] max-w-[85vw] bg-[var(--card)] border-r border-[var(--border)] flex flex-col transition-transform duration-300 ease-out
          ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className="flex flex-col items-center gap-2 px-4 pt-4 pb-3.5 border-b border-[var(--border)] bg-[var(--card)]">
          <button
            type="button"
            onClick={() => navigate("/hr/dashboard")}
            title="Go to dashboard"
            className="flex flex-col items-center gap-2 focus:outline-none"
          >
            <Logo size={76} onDark={theme === "dark"} />
            <span className="text-center">
              <span className="block font-bold text-[0.87rem] leading-tight text-[var(--ink)]">
                Talent Acquisition Portal
              </span>
              <span className="block text-[0.66rem] font-medium text-[var(--muted)] tracking-[0.03em] mt-0.5">
                Ecometrix HR Portal
              </span>
            </span>
          </button>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="px-3 pt-3 pb-1.5 text-[0.63rem] font-bold uppercase tracking-[0.13em] text-[var(--muted)]">
            Workspace
          </div>

          {visibleGroups.map((group) => {
            const GroupIcon = group.icon;
            const isOpen = openGroups[group.key] !== false;
            return (
              <div key={group.key} className="mt-0.5">
                <button
                  type="button"
                  onClick={() => setOpenGroups((s) => ({ ...s, [group.key]: !isOpen }))}
                  aria-expanded={isOpen}
                  aria-controls={`nav-group-${group.key}`}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-[11px] text-[0.86rem] font-semibold text-left text-[var(--ink)] hover:bg-[var(--card-soft)] transition-colors"
                >
                  <GroupIcon size={17} aria-hidden="true" className="text-[var(--green-mid)] shrink-0" />
                  <span>{group.label}</span>
                  <ChevronDown
                    size={15}
                    aria-hidden="true"
                    className={`ml-auto text-[var(--muted)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isOpen && (
                  <div
                    id={`nav-group-${group.key}`}
                    className="flex flex-col gap-0.5 ml-3 pl-2.5 my-1 border-l border-[var(--border)]"
                  >
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.key}
                          to={item.to}
                          end={item.to === "/hr/dashboard"}
                          onClick={onNavigate}
                          className={({ isActive }) =>
                            `relative flex items-center gap-2.5 mx-1 my-[3px] px-2.5 py-2 rounded-[9px] text-[0.8rem] font-medium transition-colors ${
                              isActive
                                ? "bg-gradient-to-r from-[var(--green-light)] to-[var(--green-softer)] text-[var(--green-dark)] font-semibold shadow-[inset_0_0_0_1px_var(--green-line)]"
                                : "text-[var(--muted)] hover:bg-[var(--card-soft)] hover:text-[var(--ink)]"
                            }`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              {isActive && (
                                <span className="absolute -left-[11px] top-1/2 -translate-y-1/2 w-[3px] h-[17px] rounded-r bg-[var(--green)]" />
                              )}
                              <Icon
                                size={16}
                                aria-hidden="true"
                                className={`shrink-0 ${isActive ? "text-[var(--green-mid)]" : "text-[var(--muted)]"}`}
                              />
                              <span className="truncate">{item.label}</span>
                            </>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--border)] p-3">
          <div className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl bg-[var(--card-soft)] border border-[var(--border)]">
            <div className="w-9 h-9 rounded-full bg-[var(--green-mid)] text-white flex items-center justify-center text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[0.8rem] font-semibold leading-tight text-[var(--ink)] truncate">
                {user?.name || "HR Administrator"}
              </div>
              <div className="text-[0.68rem] text-[var(--muted)] truncate">
                {(user?.roles || ["HR"]).join(" · ")}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              aria-label="Logout"
              className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors shrink-0"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
