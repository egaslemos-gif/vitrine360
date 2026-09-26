"use client";

import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type DataViewMode = "grid" | "list";

/** Compact Grid / List toggle for operational toolbars. */
export function ViewSwitcher({
  value,
  onChange,
  className,
}: {
  value: DataViewMode;
  onChange: (mode: DataViewMode) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-0.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5",
        className,
      )}
      role="group"
      aria-label="Modo de vista"
    >
      <button
        type="button"
        aria-pressed={value === "grid"}
        aria-label="Vista em grelha"
        onClick={() => onChange("grid")}
        className={cn(
          "inline-flex h-9 min-w-9 items-center justify-center rounded-[calc(var(--radius-md)-2px)] px-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
          value === "grid"
            ? "bg-[var(--color-primary)] text-white shadow-sm"
            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-row-hover)] hover:text-[var(--color-text-primary)]",
        )}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-pressed={value === "list"}
        aria-label="Vista em lista"
        onClick={() => onChange("list")}
        className={cn(
          "inline-flex h-9 min-w-9 items-center justify-center rounded-[calc(var(--radius-md)-2px)] px-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
          value === "list"
            ? "bg-[var(--color-primary)] text-white shadow-sm"
            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-row-hover)] hover:text-[var(--color-text-primary)]",
        )}
      >
        <List className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
