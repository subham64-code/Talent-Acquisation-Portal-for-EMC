import type { ReactNode } from "react";

export default function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="page-heading__eyebrow">{eyebrow}</p>}
        <h1 className="page-heading__title">{title}</h1>
        {description && <p className="page-heading__subtitle">{description}</p>}
      </div>
      {action}
    </div>
  );
}
