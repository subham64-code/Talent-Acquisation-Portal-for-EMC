import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import TopNav from "../../components/TopNav";

/** Keeps the shell (sidebar + top bar) on screen while the next page chunk loads. */
function ContentFallback() {
  return (
    <div className="p-6" role="status" aria-live="polite">
      <div className="h-4 w-40 rounded bg-black/10 animate-pulse" />
      <div className="mt-4 h-24 rounded-lg bg-black/5 animate-pulse" />
    </div>
  );
}

export default function HRLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <Sidebar open={mobileOpen} onNavigate={() => setMobileOpen(false)} />
      <button
        type="button"
        className={`sidebar-scrim ${mobileOpen ? "open" : ""}`}
        aria-label="Close navigation"
        onClick={() => setMobileOpen(false)}
      />
      <div className="app-main">
        <TopNav onToggleMenu={() => setMobileOpen((current) => !current)} />
        <main className="app-content">
          <Suspense fallback={<ContentFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
