import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Horizontal filter / search toolbar for list pages. */
export function FilterBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl bg-[var(--color-card)] p-3 shadow-sm ring-1 ring-black/5 sm:p-4 md:flex-row md:flex-wrap md:items-center",
        className,
      )}
    >
      {children}
    </div>
  );
}
