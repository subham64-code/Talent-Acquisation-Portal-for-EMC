import { useState, useEffect, type ReactNode } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import Logo from "../../components/Logo";
import { useAuth } from "../../context/AuthContext";

const items = [
  { to: "/it/dashboard", label: "Command Center", key: "dash", icon: "layout-dashboard" },
  { to: "/it/users", label: "User Control", key: "users", icon: "users" },
  { to: "/it/audit-log", label: "Audit Trail", key: "audit", icon: "scroll-text" },
  { to: "/it/system", label: "System & Storage", key: "system", icon: "server" },
];

function Icon({ name, className }: { name: string; className?: string }) {
  const cls = `w-5 h-5 ${className || ""}`;
  const p = (d: string, extra = "") => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <path d={d} />{extra}
    </svg>
  );
  switch (name) {
    case "layout-dashboard": return p("M3 13h8V3H3zM13 21h8v-6h-8zM13 11h8V9h-8zM3 21h8v-2H3z");
    case "users": return p("M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2", "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8-1a3 3 0 1 0-3-3");
    case "scroll-text": return p("M8 21h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H8", "M6 18H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4");
    case "server": return p("M2 12h20", "M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM8 12h.01M12 12h.01");
    default: return p("M12 3l9 4-9 4-9-4z");
  }
}

export default function ITLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const sidebar = (
    <div className="flex h-full flex-col bg-[#0D0F12] border-r border-orange-500/15 relative overflow-hidden">
      {/* ambient glow */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-64 h-64 rounded-full bg-orange-500/10 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -right-24 w-64 h-64 rounded-full bg-red-500/5 blur-3xl" />

      <div className="relative px-4 h-16 flex items-center border-b border-white/5 gap-2">
        <Logo size={30} />
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.25em] text-orange-400 uppercase leading-tight">IT Administer</p>
          <p className="text-[10px] text-white/40 leading-tight truncate">System Control Center</p>
        </div>
        <button className="ml-auto md:hidden text-white/70 p-1.5" onClick={() => setOpen(false)} aria-label="Close">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round"/></svg>
        </button>
      </div>

      <nav className="relative flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {items.map((i) => (
          <NavLink
            key={i.key}
            to={i.to}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "text-white bg-gradient-to-r from-orange-500/25 via-orange-500/10 to-transparent border border-orange-500/40 shadow-[0_0_24px_-6px_rgba(242,140,40,0.4)]"
                  : "text-white/60 hover:text-orange-200 hover:bg-white/5 border border-transparent"
              }`
            }
          >
            <Icon name={i.icon} className="shrink-0 opacity-80 group-hover:scale-110 transition-transform" />
            <span className="truncate">{i.label}</span>
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400 opacity-0 group-[.active]:opacity-100 transition-opacity" />
          </NavLink>
        ))}
      </nav>

      <div className="relative border-t border-white/5 p-4">
        <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] border border-white/5 p-2.5">
          <span className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-xs font-extrabold text-black">
            {user?.name?.charAt(0)?.toUpperCase() || "I"}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
            <p className="text-[10px] text-orange-300/80 truncate">{user?.roles?.join(" · ") || "IT_ADMIN"}</p>
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate("/auth/hr/login"); }}
          className="mt-3 w-full text-xs font-semibold text-red-300/90 hover:text-red-200 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 rounded-xl px-3 py-2 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0B0E12] text-white">
      {/* Desktop sidebar */}
      <div className="hidden md:block fixed left-0 top-0 h-full w-64 z-40">{sidebar}</div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85vw] animate-[slideIn_.25s_ease]">{sidebar}</div>
        </div>
      )}

      {/* Main column */}
      <div className="md:pl-64">
        <header className="sticky top-0 z-30 h-16 flex items-center justify-between px-4 sm:px-6 border-b border-orange-500/10 bg-[#0D0F12]/85 backdrop-blur-xl">
          <div className="flex items-center gap-3 min-w-0">
            <button className="md:hidden text-white/80 p-1.5 rounded-lg border border-white/10" onClick={() => setOpen(true)} aria-label="Menu">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round"/></svg>
            </button>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-orange-400/90 font-bold leading-none">IT Administration</p>
              <p className="text-xs text-white/50 leading-tight truncate">Operations, users &amp; security</p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-xs font-mono text-white/70 tabular-nums">{now.toLocaleTimeString()}</span>
              <span className="text-[10px] text-white/35">{now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span>
            </div>
            <Link to="/hr/dashboard" className="hidden xs:inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/60 hover:text-orange-300 border border-white/10 rounded-lg px-3 py-1.5 transition-colors">
              HR Panel →
            </Link>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400" />
            </span>
          </div>
        </header>

        <main className="relative min-h-[calc(100vh-4rem)]">
          {/* subtle grid backdrop */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.25] pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
            }}
          />
          <div className="relative p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
