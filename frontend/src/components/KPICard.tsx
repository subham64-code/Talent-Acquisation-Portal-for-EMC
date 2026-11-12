import { type ReactNode } from "react";

export default function KPICard({ title, value, subtitle, trend }: { title: string; value: ReactNode; subtitle?: string; trend?: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs ink-soft mb-1">{title}</p>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-2xl font-bold ink-body">{value}</span>
        {trend && <span className="text-xs text-[#198754] font-medium">{trend}</span>}
      </div>
      {subtitle && <p className="text-xs ink-soft">{subtitle}</p>}
    </div>
  );
}
