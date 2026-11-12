import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { hrApi } from "../lib/api";
import Logo from "./Logo";

export default function TopNav({ onToggleMenu }: { onToggleMenu: () => void }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [search, setSearch] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const loadUnread = () => {
    if (user?.type !== "HR") return;
    hrApi.unreadCount().then((r: any) => setUnread(r?.data?.count ?? 0)).catch(() => setUnread(0));
  };

  useEffect(() => { loadUnread(); }, [user?.id]);
  useEffect(() => {
    const t = setInterval(loadUnread, 45000);
    return () => clearInterval(t);
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

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (q) navigate(`/hr/submissions?search=${encodeURIComponent(q)}`);
  };

  const doLogout = () => {
    logout();
    navigate("/auth/hr/login");
  };

  return (
    <div className="sticky top-0 z-30 border-b border-[var(--border)] glass shadow-sm">
      <div className="px-3 sm:px-5 lg:px-6 flex items-center justify-between h-16 gap-2">
        {/* Left: menu + brand */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            className="rounded-xl p-2 md:hidden hover:bg-[var(--border)] transition-colors"
            onClick={onToggleMenu}
            aria-label="Open navigation menu"
          >
            <svg className="w-6 h-6 text-[var(--ink)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <div className="md:hidden shrink-0"><Logo size={26} /></div>
          <div className="hidden md:flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">EMC</span>
            <span className="text-sm font-semibold text-[var(--ink)] truncate">Talent Acquisition Portal</span>
          </div>
        </div>

        {/* Center: search */}
        <form onSubmit={submitSearch} className="hidden md:flex items-center flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.65a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z" /></svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 rounded-xl pl-10 pr-4 text-sm bg-[var(--app-bg)] border border-[var(--border)] focus:border-[#198754] focus:outline-none placeholder:text-[var(--muted)]"
              placeholder="Search candidates, jobs, emails…"
              aria-label="Global search"
            />
          </div>
        </form>

        {/* Right: actions */}
        <div className="flex items-center gap-1 sm:gap-2" ref={menuRef}>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="rounded-xl p-2.5 hover:bg-[var(--border)] transition-colors"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <svg className="w-5 h-5 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8.5-8.5h-1m-16 0h-1m13.36-6.36l-.7.7M6.34 17.66l-.7.7m12.72.7l-.7-.7M6.34 6.34l-.7-.7M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            ) : (
              <svg className="w-5 h-5 text-[var(--ink)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
            )}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              className="relative rounded-xl p-2.5 hover:bg-[var(--border)] transition-colors"
              onClick={() => { setNotifOpen((o) => !o); setMenuOpen(false); }}
              aria-label="Notifications"
            >
              <svg className="w-5 h-5 text-[var(--ink)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A0.405 0.405 0 0 1 18 14.105V11a0.405 0.405 0 0 1 0.405-0.405H14a0.405 0.405 0 0 1 0-0.81v-3c0-0.106 0.041-0.207 0.106-0.286l0.405-0.405A0.405 0.405 0 0 1 15.405 6H15a0.405 0.405 0 0 1 0-0.81v-3a0.405 0.405 0 0 1 0.405-0.405h6a0.405 0.405 0 0 1 0.405 0.405v3a0.405 0.405 0 0 1-0.405 0.405h-1.167l-0.354 0.354a0.405 0.405 0 0 1-0.572 0L19 7.586V11a0.405 0.405 0 0 1-0.405 0.405h-5a0.405 0.405 0 0 1-0.405-0.405V6h-3v4.414a0.405 0.405 0 0 1-0.572 0.572L8.354 9.057A0.405 0.405 0 0 1 8 8.414V6a0.405 0.405 0 0 1 0.405-0.405h3a0.405 0.405 0 0 1 0.405 0.405v3c0 0.106-0.041 0.207-0.106 0.286l-0.405 0.405A0.405 0.405 0 0 1 7 9.414V11c0 0.223 0.183 0.405 0.405 0.405h5c0.106 0 0.207-0.041 0.286-0.106l0.405-0.405" /></svg>
              {unread > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[20px] h-5 px-1.5 rounded-full bg-gradient-to-br from-[#F28C28] to-[#D97417] text-white text-[10px] font-extrabold flex items-center justify-center shadow">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-[var(--border)] card shadow-2xl p-3 animate-in z-40">
                <div className="flex items-center justify-between px-1 pb-2 border-b border-[var(--border)] mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">Notifications</p>
                  {unread > 0 && <span className="text-[10px] font-extrabold text-[#F28C28]">{unread} unread</span>}
                </div>
                <button
                  onClick={() => { setNotifOpen(false); navigate("/hr/notifications"); }}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold text-[#198754] hover:bg-[rgba(25,135,84,.08)] transition-colors flex items-center justify-between"
                >
                  Open inbox
                  <span aria-hidden>→</span>
                </button>
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="relative">
            <button
              className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-[var(--border)] transition-colors"
              onClick={() => { setMenuOpen((o) => !o); setNotifOpen(false); }}
              aria-label="Account menu"
            >
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#198754] to-[#0F3D2E] flex items-center justify-center text-xs font-extrabold text-white shadow">
                {user?.name?.charAt(0)?.toUpperCase() || "H"}
              </span>
              <span className="hidden sm:block text-left leading-tight max-w-[140px]">
                <span className="block text-xs font-bold text-[var(--ink)] truncate">{user?.name}</span>
                <span className="block text-[10px] text-[var(--muted)] truncate">{(user?.roles || ["HR"]).join(" · ")}</span>
              </span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-[var(--border)] card shadow-2xl py-2 animate-in z-40">
                <div className="px-4 py-2.5 border-b border-[var(--border)] mb-1">
                  <p className="text-sm font-bold text-[var(--ink)] truncate">{user?.name}</p>
                  <p className="text-[11px] text-[var(--muted)] truncate">{user?.email}</p>
                </div>
                <button onClick={() => { setMenuOpen(false); navigate("/hr/settings"); }} className="w-full text-left px-4 py-2 text-sm text-[var(--ink-soft)] hover:bg-[var(--border)] transition-colors">Settings</button>
                <button onClick={doLogout} className="w-full text-left px-4 py-2 text-sm font-semibold text-orange-600 hover:bg-[rgba(217,116,23,.1)] transition-colors">Logout</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
