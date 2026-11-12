import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import TopNav from "../../components/TopNav";

export default function HRLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen surface-app">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div className={`${collapsed ? "md:pl-[68px]" : "md:pl-64"} pl-0 transition-[padding] duration-300`}>
        <TopNav onToggleMenu={() => setMobileOpen(true)} />
        <main className="pb-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
