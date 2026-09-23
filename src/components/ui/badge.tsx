import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "success" | "warning" | "danger" | "muted";
}) {
  const styles = {
    default: "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]",
    success: "bg-[var(--color-success)] text-white",
    warning: "bg-[var(--color-warning)] text-black",
    danger: "bg-[var(--color-destructive)] text-white",
    muted: "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
  } as const;
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}
