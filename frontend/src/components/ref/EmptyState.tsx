import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export default function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon"><Icon size={28} aria-hidden="true" /></span>
      <p className="empty-state__title">{title}</p>
      <p className="empty-state__text">{description}</p>
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
