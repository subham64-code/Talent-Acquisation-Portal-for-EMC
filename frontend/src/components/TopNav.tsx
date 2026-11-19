import { useEffect, useRef, useState } from "react";
import { Bell, Menu, Moon, Sun } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { hrApi } from "../lib/api";

export default function TopNav({ onToggleMenu }: { onToggleMenu: () => void }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const dark = theme === "dark";
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName = /^emc[\s-]+hr[\s-]+administrator$/i.test((user?.name || "").trim()) ? "HR Department" : user?.name || "HR Department";

  useEffect(() => {
    if (user?.type !== "HR") return;
    const load = () =>
      hrApi
        .unreadCount()
        .then((r: any) => setUnread(r?.data?.count ?? 0))
        .catch(() => setUnread(0));
    load();
    const timer = setInterval(load, 45000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const doLogout = async () => {
    await logout();
    navigate("/auth/hr/login");
  };

  const initials = displayName
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="app-header">
      <button
        type="button"
        className="app-header__icon-btn mobile-toggle"
        onClick={onToggleMenu}
        aria-label="Open navigation"
      >
        <Menu size={19} />
      </button>

      <div className="app-header__portal" role="status" aria-label="ECOMETRIX TALENT ACQUISITION PORTAL">
        <span className="app-header__portal-title">ECOMETRIX&nbsp;&nbsp;<em>TALENT ACQUISITION</em>&nbsp;&nbsp;<i>PORTAL</i></span>
      </div>

      <div className="app-header__spacer" />

      <div className="app-header__actions" ref={menuRef}>
        <button
          type="button"
          className="app-header__icon-btn"
          aria-label={`Switch to ${dark ? "light" : "dark"} theme`}
          title={`Switch to ${dark ? "light" : "dark"} theme`}
          onClick={toggleTheme}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button
          type="button"
          className="app-header__icon-btn"
          aria-label="Notifications"
          onClick={() => navigate("/hr/notifications")}
        >
          <Bell size={18} />
          {unread > 0 && <span className="app-header__dot" />}
        </button>

        <div className="app-header__divider" />

        <div className="relative">
          <button
            type="button"
            className="app-header__profile"
            onClick={() => setMenuOpen((current) => !current)}
            aria-label="Account menu"
          >
            <div className="avatar">{initials}</div>
            <div className="app-header__profile-text">
              <span className="app-header__profile-name">{displayName}</span>
              <span className="app-header__profile-role">{(user?.roles || ["HR"]).join(" · ")}</span>
            </div>
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-56 rounded-xl border bg-white shadow-lg py-1.5 z-50"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div className="px-4 py-2 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
                <p className="text-sm font-bold" style={{ color: "var(--color-text)" }}>{displayName}</p>
                <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); navigate("/hr/settings"); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--color-surface-muted)]"
                style={{ color: "var(--color-text)" }}
              >
                Settings
              </button>
              <button
                type="button"
                onClick={doLogout}
                className="w-full text-left px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
