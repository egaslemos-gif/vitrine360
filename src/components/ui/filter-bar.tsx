import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Horizontal filter / search toolbar for list pages — white surface, not glass. */
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
        "ui-toolbar flex flex-col gap-3 p-3 sm:p-3.5 md:flex-row md:flex-wrap md:items-center",
        className,
      )}
    >
      {children}
    </div>
  );
}
