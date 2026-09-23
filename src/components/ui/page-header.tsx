import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Standard admin page header — title, description, primary action.
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
        "admin-page-header flex flex-col gap-4 pb-4 pt-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1
          className="text-3xl font-bold tracking-tight text-[var(--color-primary)]"
          style={{ fontFamily: "var(--font-display), Georgia, serif" }}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
