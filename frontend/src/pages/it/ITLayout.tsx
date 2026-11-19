import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ScrollText,
  Server,
  Menu,
  LogOut,
  ArrowRight,
} from "lucide-react";
import Logo from "../../components/Logo";
import { useAuth } from "../../context/AuthContext";

const items = [
  { to: "/it/dashboard", label: "Command Center", icon: LayoutDashboard },
  { to: "/it/users", label: "User Control", icon: Users },
  { to: "/it/audit-log", label: "Audit Trail", icon: ScrollText },
  { to: "/it/system", label: "System & Storage", icon: Server },
];

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

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const current = items.find((i) => location.pathname.startsWith(i.to))?.label || "Command Center";
  const initials = (user?.name || "A").charAt(0).toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col border-r border-[var(--border)] bg-white">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-[var(--border)] flex flex-col items-center text-center">
        <Link to="/it/dashboard" className="flex flex-col items-center gap-2 focus:outline-none">
          <Logo size={76} />
          <span className="text-sm font-semibold tracking-wide text-gray-800">Admin Portal</span>
          <span className="text-[10px] text-[var(--muted)] -mt-1">System Control Center</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((i) => {
          const active = location.pathname.startsWith(i.to);
          const Icon = i.icon;
          return (
            <Link
              key={i.to}
              to={i.to}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-100 text-brand-700"
                  : "text-gray-600 hover:bg-brand-50 hover:text-brand-700"
              }`}
            >
              {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-brand-600" />}
              <Icon size={18} className={`shrink-0 ${active ? "text-brand-600" : "text-gray-400"}`} />
              <span className="truncate">{i.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto border-t border-[var(--border)] p-4 space-y-3">
        <div className="flex items-center gap-3 px-1">
          <div className="h-9 w-9 rounded-full bg-brand-600 text-white flex items-center justify-center font-semibold text-sm shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 leading-tight truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.roles?.join(" · ") || "IT_ADMIN"}</p>
          </div>
        </div>
        <button
          onClick={() => {
            logout();
            navigate("/auth/hr/login");
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex overflow-hidden bg-[#f6f8f2]">
      {/* Desktop sidebar */}
      <div className="hidden lg:block fixed left-0 top-0 h-full w-72 z-40">{sidebar}</div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl">{sidebar}</div>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-72">
        <header className="sticky top-0 z-30 h-16 flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 border-b border-[var(--border)] bg-white/90 backdrop-blur-[16px]">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden w-10 h-10 grid place-items-center rounded-xl text-gray-500 hover:bg-brand-50 hover:text-brand-700 transition-colors"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={19} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-gray-500">
                <span className="hidden sm:inline">Ecometrix</span>
                <span className="hidden sm:inline">/</span>
                <span className="hidden sm:inline">Admin Portal</span>
                <span className="hidden sm:inline">/</span>
                <span className="font-semibold text-gray-900 truncate">{current}</span>
              </div>
              <p className="text-[10px] text-[var(--muted)] hidden sm:block">Operations, users &amp; security</p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-xs font-mono text-gray-700 tabular-nums">{now.toLocaleTimeString()}</span>
              <span className="text-[10px] text-gray-400">
                {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </span>
            </div>
            <Link
              to="/hr/dashboard"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-700 border border-[var(--border)] rounded-lg px-3 py-1.5 hover:bg-brand-50 transition-colors"
            >
              HR Panel <ArrowRight size={12} />
            </Link>
            <span className="relative flex h-3 w-3" title="Systems operational">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-60" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-500" />
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
