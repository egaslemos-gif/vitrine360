import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Enhanced admin page header — large greeting-style title.
 * Inspired by EduSphere "Hello, Anna / Your Custom Syllabus" pattern.
 * Sticky via `.admin-page-header` in globals.css.
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
        "admin-page-header flex flex-col gap-3 pb-5 pt-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {greeting ? (
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
            {greeting}
          </p>
        ) : null}
        <h1 className="ui-page-title mt-0.5">{title}</h1>
        {description ? (
          <p className="ui-secondary mt-1.5 max-w-xl">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
