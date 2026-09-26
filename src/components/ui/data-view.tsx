import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** White surface shell for compact operational lists. */
export function ListView({
  children,
  className,
  header,
}: {
  children: ReactNode;
  className?: string;
  /** Optional column header row (desktop). */
  header?: ReactNode;
}) {
  return (
    <div className={cn("ui-list-shell", className)} role="table">
      {header ? (
        <div className="ui-list-header" role="row">
          {header}
        </div>
      ) : null}
      <div role="rowgroup">{children}</div>
    </div>
  );
}

/** Compact operational row — 64–84px. Not a card. */
export function ListRow({
  children,
  className,
  selected,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      role="row"
      aria-selected={selected}
      data-selected={selected ? "true" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn("ui-list-row", className)}
    >
      {children}
    </div>
  );
}

/** Visual discovery grid for media / device cards. */
export function GridView({
  children,
  className,
  columns = "media",
}: {
  children: ReactNode;
  className?: string;
  columns?: "media" | "devices" | "default";
}) {
  const cols =
    columns === "media"
      ? "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      : columns === "devices"
        ? "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        : "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return <div className={cn(cols, className)}>{children}</div>;
}
