import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Compact operational page header.
 * Sticky only on md+ (see `.admin-page-header` in globals.css).
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
  greeting,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  /** Optional greeting line above the title */
  greeting?: string;
}) {
  return (
    <header
      className={cn(
        "admin-page-header flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {greeting ? (
          <p className="text-xs font-medium text-[var(--color-text-secondary)] sm:text-sm">
            {greeting}
          </p>
        ) : null}
        <h1 className="ui-page-title mt-0">{title}</h1>
        {description ? (
          <p className="ui-secondary mt-1 max-w-xl line-clamp-2 sm:line-clamp-none">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
