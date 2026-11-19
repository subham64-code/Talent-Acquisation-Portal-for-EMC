import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import TopNav from "../../components/TopNav";

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
          <Outlet />
        </main>
      </div>
    </div>
  );
}
