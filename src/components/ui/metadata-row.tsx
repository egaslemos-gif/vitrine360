import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Label + value row for card / detail metadata. */
export function MetadataRow({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline justify-between gap-2 text-sm",
        className,
      )}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </span>
      <span className="min-w-0 text-right text-[var(--color-foreground)]">
        {children}
      </span>
    </div>
  );
}
