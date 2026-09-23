import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatTone = "neutral" | "info" | "success" | "danger" | "accent";

const TONE_ICON: Record<StatTone, string> = {
  neutral: "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
  info: "bg-[var(--color-info)]/15 text-[var(--color-info)]",
  success: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
  danger: "bg-[var(--color-destructive)]/15 text-[var(--color-destructive)]",
  accent: "bg-[var(--color-type-video)]/15 text-[var(--color-type-video)]",
};

/** Reusable summary metric card for admin dashboards. */
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
        "border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-subtle)]",
        className,
      )}
    >
      <CardContent className="flex items-start gap-3 p-5">
        {icon ? (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              TONE_ICON[tone],
            )}
            aria-hidden
          >
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {title}
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-[var(--color-foreground)]">
            {value}
          </p>
          {hint ? (
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              {hint}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
