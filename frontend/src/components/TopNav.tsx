import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronRight, HelpCircle, Menu } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { hrApi } from "../lib/api";
import HelpSupportModal from "./HelpSupportModal";

const SECTION_LABELS: Record<string, string> = {
  dashboard: "Recruitment Dashboard",
  openings: "Manage Openings",
  submissions: "Candidate Submissions",
  "ai-screening": "AI Screening",
  interviews: "Interviews",
  offers: "Offer Management",
  onboarding: "Joining & Onboarding",
  employees: "Employee Management",
  databank: "CV Databank",
  departments: "Departments",
  reports: "Reports & Analytics",
  notifications: "Notifications",
  users: "HR User Management",
  settings: "Settings",
  "access-control": "Access Control",
};

function sectionLabel(pathname: string): string {
  if (/^\/hr\/departments\/[^/]+/.test(pathname)) return "Department Detail";
  const segment = pathname.split("/").filter(Boolean).pop() || "dashboard";
  return SECTION_LABELS[segment] || "HR Portal";
}

export default function TopNav({ onToggleMenu }: { onToggleMenu: () => void }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const label = sectionLabel(location.pathname);

  const loadUnread = () => {
    if (user?.type !== "HR") return;
    hrApi
      .unreadCount()
      .then((r: any) => setUnread(r?.data?.count ?? 0))
      .catch(() => setUnread(0));
  };

  useEffect(() => {
    loadUnread();
    const t = setInterval(loadUnread, 45000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  const doLogout = async () => {
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
    <header className="app-header-bg sticky top-0 z-40 h-[64px] md:h-[74px] flex items-center gap-2 md:gap-4 px-3 sm:px-5 lg:px-8 backdrop-blur-[16px] backdrop-saturate-[1.4] border-b border-[var(--border)]">
      {/* Mobile menu */}
      <button
        type="button"
        onClick={onToggleMenu}
        aria-label="Open navigation"
        className="md:hidden w-10 h-10 grid place-items-center rounded-[11px] border border-transparent text-[var(--muted)] hover:bg-[var(--green-softer)] hover:border-[var(--border)] hover:text-[var(--green-dark)] transition-colors"
      >
        <Menu size={19} />
      </button>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[0.78rem] text-[var(--muted)] min-w-0" aria-label="Breadcrumb">
        <span className="whitespace-nowrap hidden sm:inline">Ecometrix</span>
        <ChevronRight size={13} aria-hidden="true" className="hidden sm:block text-[var(--muted)] shrink-0" />
        <span className="whitespace-nowrap hidden sm:inline">Talent Acquisition</span>
        <ChevronRight size={13} aria-hidden="true" className="hidden sm:block text-[var(--muted)] shrink-0" />
        <strong className="text-[var(--ink)] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
          {label}
        </strong>
      </nav>

      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-1 sm:gap-1.5" ref={menuRef}>
        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="w-[38px] h-[38px] rounded-[11px] border border-transparent text-[var(--muted)] grid place-items-center hover:bg-[var(--green-softer)] hover:border-[var(--border)] hover:text-[var(--green-dark)] transition-colors"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8.5-8.5h-1m-16 0h-1m13.36-6.36l-.7.7M6.34 17.66l-.7.7m12.72.7l-.7-.7M6.34 6.34l-.7-.7M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
          )}
        </button>

        {/* Help */}
        <button
          type="button"
          className="w-[38px] h-[38px] rounded-[11px] border border-transparent text-[var(--muted)] grid place-items-center hover:bg-[var(--green-softer)] hover:border-[var(--border)] hover:text-[var(--green-dark)] transition-colors"
          aria-label="Help & Support"
          title="Help & Support"
          onClick={() => {
            setHelpOpen(true);
            setMenuOpen(false);
            setNotifOpen(false);
          }}
        >
          <HelpCircle size={18} />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            type="button"
            className="relative w-[38px] h-[38px] rounded-[11px] border border-transparent text-[var(--muted)] grid place-items-center hover:bg-[var(--green-softer)] hover:border-[var(--border)] hover:text-[var(--green-dark)] transition-colors"
            onClick={() => {
              setNotifOpen((o) => !o);
              setMenuOpen(false);
            }}
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-[var(--orange)] border-[1.5px] border-[var(--card)] shadow-[0_0_0_2px_rgba(255,148,18,0.16)]" />
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_12px_30px_rgba(23,23,23,0.18)] p-3 animate-in z-40">
              <div className="flex items-center justify-between px-1 pb-2 border-b border-[var(--border)] mb-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">Notifications</p>
                {unread > 0 && <span className="text-[10px] font-extrabold text-[var(--orange-mid)]">{unread} unread</span>}
              </div>
              <button
                onClick={() => {
                  setNotifOpen(false);
                  navigate("/hr/notifications");
                }}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold text-[var(--green-mid)] hover:bg-[var(--green-softer)] transition-colors flex items-center justify-between"
              >
                Open inbox
                <span aria-hidden>→</span>
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-7 bg-[var(--border)] mx-1 hidden sm:block" />

        {/* Profile */}
        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-2.5 p-1 pr-1 sm:pr-2 rounded-xl hover:bg-[var(--card-soft)] transition-colors"
            onClick={() => {
              setMenuOpen((o) => !o);
              setNotifOpen(false);
            }}
            aria-label="Account menu"
          >
            <span className="w-9 h-9 rounded-full bg-[var(--green-mid)] text-white flex items-center justify-center text-xs font-bold shrink-0">
              {initials}
            </span>
            <span className="hidden lg:block text-left leading-tight max-w-[160px]">
              <span className="block text-[0.78rem] font-semibold text-[var(--ink)] truncate">{user?.name}</span>
              <span className="block text-[0.68rem] text-[var(--muted)] truncate">{(user?.roles || ["HR"]).join(" · ")}</span>
            </span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_12px_30px_rgba(23,23,23,0.18)] py-2 animate-in z-40">
              <div className="px-4 py-2.5 border-b border-[var(--border)] mb-1">
                <p className="text-sm font-bold text-[var(--ink)] truncate">{user?.name}</p>
                <p className="text-[11px] text-[var(--muted)] truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/hr/settings");
                }}
                className="w-full text-left px-4 py-2 text-sm text-[var(--ink-soft)] hover:bg-[var(--card-soft)] transition-colors"
              >
                Settings
              </button>
              <button
                onClick={doLogout}
                className="w-full text-left px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>

    {helpOpen && <HelpSupportModal onClose={() => setHelpOpen(false)} />}
    </>
  );
}
