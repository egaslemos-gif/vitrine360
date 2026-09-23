import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Standard admin page header — compact operational title (Inter).
 * Sticky via `.admin-page-header` in globals.css.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "admin-page-header flex flex-col gap-3 pb-4 pt-2 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="ui-page-title">{title}</h1>
        {description ? (
          <p className="ui-secondary mt-1 max-w-xl">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
