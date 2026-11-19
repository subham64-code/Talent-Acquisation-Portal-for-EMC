import type { ReactNode } from "react";

const VARIANTS = ["green", "orange", "blue", "red", "grey", "purple"] as const;
export type BadgeVariant = (typeof VARIANTS)[number];

export default function Badge({
  children,
  variant = "grey",
  dot = false,
  className = "",
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}) {
  const safeVariant = VARIANTS.includes(variant as BadgeVariant) ? variant : "grey";
  return (
    <span className={`badge badge--${safeVariant} ${className}`.trim()}>
      {dot && <span className="badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
