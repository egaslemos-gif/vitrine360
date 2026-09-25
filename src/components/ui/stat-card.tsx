import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatTone = "neutral" | "info" | "success" | "danger" | "accent" | "warning";

const TONE_CONFIG: Record<
  StatTone,
  { value: string; bg: string; glow: string; shape: string }
> = {
  neutral: {
    value: "text-[var(--color-text-primary)]",
    bg: "bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-muted)]",
    glow: "bg-[var(--color-muted-foreground)]/8",
    shape: "bg-[var(--color-muted-foreground)]/10",
  },
  info: {
    value: "text-[var(--color-info)]",
    bg: "bg-gradient-to-br from-[var(--color-surface)] via-[var(--color-surface)] to-blue-50",
    glow: "bg-[var(--color-info)]/8",
    shape: "bg-[var(--color-info)]/12",
  },
  success: {
    value: "text-[var(--color-success)]",
    bg: "bg-gradient-to-br from-[var(--color-surface)] via-[var(--color-surface)] to-emerald-50",
    glow: "bg-[var(--color-success)]/8",
    shape: "bg-[var(--color-success)]/12",
  },
  danger: {
    value: "text-[var(--color-danger)]",
    bg: "bg-gradient-to-br from-[var(--color-surface)] via-[var(--color-surface)] to-red-50",
    glow: "bg-[var(--color-danger)]/8",
    shape: "bg-[var(--color-danger)]/12",
  },
  accent: {
    value: "text-[var(--color-primary)]",
    bg: "bg-gradient-to-br from-[var(--color-surface)] via-[var(--color-surface)] to-[var(--color-primary-soft)]",
    glow: "bg-[var(--color-primary)]/8",
    shape: "bg-[var(--color-primary)]/12",
  },
  warning: {
    value: "text-[var(--color-warning)]",
    bg: "bg-gradient-to-br from-[var(--color-surface)] via-[var(--color-surface)] to-amber-50",
    glow: "bg-[var(--color-warning)]/8",
    shape: "bg-[var(--color-warning)]/12",
  },
};

/** Enhanced operational metric card with decorative shapes and gradients. */
export function StatCard({
  title,
  value,
  hint,
  icon,
  tone = "neutral",
  className,
}: {
  title: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: StatTone;
  className?: string;
}) {
  const config = TONE_CONFIG[tone];

  return (
    <Card
      className={cn(
        "group relative overflow-hidden border border-[var(--color-border)] shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-elevated)] hover:-translate-y-0.5",
        config.bg,
        className,
      )}
    >
      {/* Decorative corner shape */}
      <div
        className={cn(
          "absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-60 blur-md transition-opacity duration-300 group-hover:opacity-80",
          config.glow,
        )}
        aria-hidden
      />
      <div
        className={cn(
          "absolute -right-1 -top-1 h-10 w-10 rounded-full opacity-50",
          config.shape,
        )}
        aria-hidden
      />

      <CardContent className="relative px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {title}
            </p>
            <p
              className={cn(
                "mt-2 text-3xl font-bold tabular-nums tracking-tight",
                config.value,
              )}
            >
              {value}
            </p>
            {hint ? (
              <p className="mt-1 text-[12px] font-medium text-[var(--color-text-secondary)]">
                {hint}
              </p>
            ) : null}
          </div>
          {icon ? (
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)]",
                config.shape,
              )}
            >
              {icon}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
