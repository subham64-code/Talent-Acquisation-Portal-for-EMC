import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

const VARIANTS: Record<string, string> = {
  primary: "btn--primary",
  secondary: "btn--secondary",
  outline: "btn--outline",
  ghost: "btn--ghost",
  danger: "btn--danger",
  "danger-ghost": "btn--danger-ghost",
};

const SIZES: Record<string, string> = { sm: "btn--sm", md: "", lg: "btn--lg" };

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  loading?: boolean;
  icon?: LucideIcon | null;
  iconPosition?: "left" | "right";
  block?: boolean;
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  loading = false,
  disabled = false,
  icon: Icon = null,
  iconPosition = "left",
  type = "button",
  block = false,
  ...rest
}: Props) {
  const classes = [
    "btn",
    VARIANTS[variant] || VARIANTS.primary,
    SIZES[size] ?? "",
    block ? "btn--block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const iconNode = Icon ? <Icon size={size === "sm" ? 14 : 16} aria-hidden="true" /> : null;

  return (
    <button type={type} className={classes} disabled={disabled || loading} {...rest}>
      {loading ? (
        <span className="btn__spinner" aria-hidden="true" />
      ) : (
        iconPosition === "left" && iconNode
      )}
      {children}
      {!loading && iconPosition === "right" && iconNode}
    </button>
  );
}
