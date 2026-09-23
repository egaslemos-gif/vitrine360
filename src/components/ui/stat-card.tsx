import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatTone = "neutral" | "info" | "success" | "danger" | "accent" | "warning";

const TONE_ICON: Record<StatTone, string> = {
  neutral: "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]",
  info: "bg-[var(--color-info)]/12 text-[var(--color-info)]",
  success: "bg-[var(--color-success)]/12 text-[var(--color-success)]",
  danger: "bg-[var(--color-danger)]/10 text-[var(--color-danger)]",
  accent: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
  warning: "bg-[var(--color-warning)]/15 text-[color-mix(in_oklab,var(--color-warning)_70%,black)]",
};

/** Lightweight summary metric — label, value, minimal context. */
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
  return (
    <Card
      className={cn(
        "border border-[var(--color-border)] bg-[var(--color-surface)] shadow-none",
        className,
      )}
    >
      <CardContent className="flex items-start gap-3 p-4">
        {icon ? (
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              TONE_ICON[tone],
            )}
            aria-hidden
          >
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="ui-caption font-medium uppercase tracking-wide">
            {title}
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-[var(--color-text-primary)]">
            {value}
          </p>
          {hint ? <p className="ui-caption mt-0.5">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
