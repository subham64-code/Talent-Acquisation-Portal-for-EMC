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
    <div className="min-h-screen bg-[var(--app-bg)]">
      <Sidebar open={mobileOpen} onNavigate={() => setMobileOpen(false)} />

      <div className="pl-0 md:pl-[268px] transition-[padding] duration-300">
        <TopNav onToggleMenu={() => setMobileOpen(true)} />
        <main className="pb-10">
          <div className="max-w-[1560px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
