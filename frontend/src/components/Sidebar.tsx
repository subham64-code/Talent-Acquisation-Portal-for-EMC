import { useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, FileText, Users, FolderOpen, CalendarClock, Sparkles, FileBadge, Building2, BarChart3, Settings, LogOut, ShieldCheck, FileCheck2, BellRing, ClipboardCheck, KeyRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Logo from "./Logo";
import { SECTION_PERMISSIONS, canAccess, isController } from "../lib/sectionPermissions";

const items: Array<{ key: string; label: string; to: string; icon: any; controllerOnly?: boolean }> = [
  { key: "dashboard", label: "Dashboard", to: "/hr/dashboard", icon: LayoutDashboard },
  { key: "openings", label: "Manage Openings", to: "/hr/openings", icon: FileText },
  { key: "submissions", label: "View Submissions", to: "/hr/submissions", icon: FileCheck2 },
  { key: "ai", label: "AI Screening", to: "/hr/ai-screening", icon: Sparkles },
  { key: "interviews", label: "Schedule Interviews", to: "/hr/interviews", icon: CalendarClock },
  { key: "offers", label: "Offer Letters", to: "/hr/offers", icon: FileBadge },
  { key: "onboarding", label: "Onboarding Docs", to: "/hr/onboarding", icon: ClipboardCheck },
  { key: "employees", label: "Employee Management", to: "/hr/employees", icon: Users },
  { key: "databank", label: "CV Databank", to: "/hr/databank", icon: FolderOpen },
  { key: "reports", label: "Reports & Analytics", to: "/hr/reports", icon: BarChart3 },
  { key: "notifications", label: "Notifications", to: "/hr/notifications", icon: BellRing },
  { key: "users", label: "HR User Management", to: "/hr/users", icon: ShieldCheck },
  { key: "departments", label: "Departments", to: "/hr/departments", icon: Building2 },
  { key: "settings", label: "Settings", to: "/hr/settings", icon: Settings },
  { key: "access-control", label: "Access Control", to: "/hr/access-control", icon: KeyRound, controllerOnly: true },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onClose }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const visibleItems = items.filter((i) =>
    i.controllerOnly ? isController(user) : canAccess(user, SECTION_PERMISSIONS[i.key]),
  );

  useEffect(() => {
    const on = () => onClose();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [onClose]);

  const handleLogout = () => {
    logout();
    navigate("/auth/hr/login");
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full z-50 surface-card border-r border-[var(--border)] transition-all duration-300 ease-out flex flex-col shadow-xl md:shadow-none
          ${collapsed ? "w-[68px]" : "w-64"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between h-16 px-3 shrink-0 border-b border-[var(--border)]">
          <button className="flex items-center gap-2.5 min-w-0 group" onClick={onToggle} title={collapsed ? "Expand menu" : "Collapse menu"}>
            <span className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-[#198754] to-[#0F3D2E] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
              <Logo size={20} />
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block font-extrabold text-base ink-body leading-none tracking-tight">EMC<span className="text-[#F28C28]">.</span>HR</span>
                <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)] mt-0.5">Talent Acquisition</span>
              </span>
            )}
          </button>
          <button className="rounded-lg p-2 hover:bg-[var(--border)] md:hidden transition-colors" onClick={onClose} title="Close menu" aria-label="Close menu">
            <svg className="w-5 h-5 ink-body" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">
          {visibleItems.map((i) => {
            const Icon = i.icon;
            return (
              <NavLink
                key={i.key}
                to={i.to}
                onClick={onClose}
                title={collapsed ? i.label : undefined}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "text-white bg-gradient-to-r from-[#198754] via-[#1F8A58] to-[#146C43] shadow-md shadow-emerald-900/20"
                      : "ink-soft hover:bg-[rgba(25,135,84,.08)] hover:text-[#198754]"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-1.5 rounded-r-full bg-[#F28C28]" />}
                    <Icon className={`shrink-0 w-5 h-5 ${isActive ? "text-white" : "text-[var(--muted)] group-hover:text-[#198754]"} transition-colors`} strokeWidth={1.8} />
                    {!collapsed && <span className="truncate">{i.label}</span>}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer / logout */}
        <div className="p-2 border-t border-[var(--border)] shrink-0">
          <button
            onClick={handleLogout}
            title={collapsed ? "Logout" : undefined}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-orange-700 dark:text-orange-400 hover:bg-orange-50 transition-colors"
          >
            <LogOut className="shrink-0 w-5 h-5" strokeWidth={1.8} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
